export interface Texts {
  basics: {
    name: string;
    button: string;
    description: string;
    instructions: string;
    optional: string;
    loading: string;
    thinking: string;
    model: string;
    apps: string;
  }

  messageForm: {
    placeholder: string;
    attachFile: string;
    send: string;
    stop: string;
  }

  appPage: {
    title: string;
    buttonNewConfig: string;
    chatsTitle: string;
    description: string;
    contactMessage: string;
  }

  appConfigPage: {
    newConfigTitle: string;
    editConfigTitle: string;
    defaultConfigTitle: string;
    editAssistantTitle: string;
    editAssistantButton: string;
    startChatTitle: string;
    startChatDescription: string;
    dragToReorder: string;
    newConfigButton: string;
    buttonCreate: string;
    buttonSave: string;
    namePlaceholder: string;
    descriptionPlaceholder: string;
    instructionsPlaceholder: string;
    buttonPlaceholder: string;
    gotoNewConfig: string;
    errorValidationRequired: string;
    errorAppConfigLoadFailure: string;
    tableCell: {
      deleteButton: string;
      visibilityLabel: string;
      deleteLabel: string;
    };
    defaultConfigMessage: string;
    defaultConfigGotoNew: string;
    description: string;
  }

  appConfigDropdown: {
    placeholder: string;
    newAssistant: string;
    editConfigTitle: string;
    editAssistantLabel: (assistantName: string) => string;
  }

  modelSelection: {
    manageProviders: string;
    done: string;
    backToSelection: string;
  }

  settingsPage: {
    title: string;
    appearance: {
      title: string;
      theme: string;
      language: string;
      colorScheme: string;
      system: string;
      dark: string;
      light: string;
      switchToLightMode: string;
      switchToDarkMode: string;
    };
    providers: {
      title: string;
      description: string;
    };
    spaces: {
      title: string;
      spaceCount: (count: number) => string;
      manageButton: string;
    };
    developers: {
      title: string;
      toggleDevMode: string;
    };
  }

  spacesPage: {
    title: string;
    description: string;
    opener: {
      createTitle: string;
      createDescription: string;
      createButton: string;
      openTitle: string;
      openDescription: string;
      openButton: string;
      errorCreate: string;
      errorOpen: string;
      errorOpenTitle: string;
      errorOpenUnknown: string;
      dialogCreateTitle: string;
      dialogOpenTitle: string;
    };
    openerPageTitle: string;
    openerPageDescription: string;
    addWorkspaceButton: string;
    defaultWorkspaceName: string;
    manageWorkspacesButton: string;
  };

  actions: {
    open: string;
    edit: string;
    delete: string;
    done: string;
    cancel: string;
    confirm: string;
    close: string;
    copy: string;
    add: string;
    update: string;
    save: string;
    saving: string;
    change: string;
    choose: string;
    retry: string;
    rename: string;
    removeFromList: string;
    openInNewTab: string;
    duplicate: string;
    connect: string;
    disconnect: string;
    configure: string;
    how: string;
    attach: string;
    ok: string;
    goBack: string;
    closeAll: string;
    back: string;
    next: string;
    finish: string;
  };

  markdownTextDocument: {
    openButton: string;
    loading: string;
    loadError: string;
    openAriaLabel: (fileName: string) => string;
  };

  markdownImage: {
    openImageAria: (fileName: string) => string;
    failedToLoad: (fileUrl: string) => string;
  };

  models: {
    auto: string;
    selectModelTitle: string;
    chooseModelRequired: string;
    invalidModelFormat: (value: string) => string;
    unknownProvider: (providerId: string) => string;
    enterModel: string;
    chooseModel: string;
    modelNameLabel: string;
    openRouterPlaceholder: string;
    openRouterHelp: string;
    defaultOption: (label: string) => string;
  };

  providers: {
    connected: string;
    validationFailed: string;
    apiKeyValidationFailed: string;
    unknownError: string;
    connectionFailed: string;
    editTitle: string;
    deleteTitle: string;
    deletePrompt: string;
    visitWebsiteTitle: string;
  };

  customProviderSetup: {
    titleAdd: string;
    titleEdit: string;
    labelProviderName: string;
    labelBaseApiUrl: string;
    labelApiKey: string;
    labelModelId: string;
    labelCustomHeaders: string;
    placeholderName: string;
    placeholderBaseApiUrl: string;
    placeholderApiKey: string;
    placeholderModelId: string;
    placeholderHeaders: string;
    headersHint: string;
    invalidHeadersFormat: string;
    saveError: string;
    addModalTitle: string;
    addButton: string;
  };

  customProviderForm: {
    titleAdd: string;
    titleEdit: string;
    labelProviderName: string;
    labelApiUrl: string;
    labelApiKey: string;
    labelModelId: string;
    labelCustomHeaders: string;
    placeholderName: string;
    placeholderApiUrl: string;
    placeholderApiKey: string;
    placeholderModelId: string;
    placeholderHeaders: string;
    hintBaseUrl: string;
    hintModelId: string;
    hintHeaders: string;
    validationNameRequired: string;
    validationApiUrlRequired: string;
    validationApiUrlInvalid: string;
    validationApiKeyRequired: string;
    validationModelIdRequired: string;
    saveFailed: (message: string) => string;
    buttonUpdate: string;
    buttonAddProvider: string;
  };

  modelProviderSetup: {
    title: (providerName: string) => string;
    openai: {
      intro: string;
      steps: {
        signup: string;
        addCredits: string;
        createKey: string;
        pasteKey: string;
      };
    };
    anthropic: {
      intro: string;
      steps: {
        signup: string;
        createKey: string;
        pasteKey: string;
      };
    };
    groq: {
      intro: string;
      steps: {
        signup: string;
        createKey: string;
        pasteKey: string;
      };
    };
    deepseek: {
      intro: string;
      steps: {
        signup: string;
        createKey: string;
        pasteKey: string;
      };
    };
    google: {
      intro: string;
      steps: {
        signup: string;
        createKey: string;
        pasteKey: string;
      };
    };
    xai: {
      intro: string;
      steps: {
        signup: string;
        createTeam: string;
        pasteKey: string;
      };
    };
    cohere: {
      intro: string;
      steps: {
        signup: string;
        createKey: string;
        pasteKey: string;
      };
    };
    mistral: {
      intro: string;
      steps: {
        signup: string;
        createKey: string;
        pasteKey: string;
      };
    };
    ollama: {
      intro: string;
      steps: {
        download: string;
        install: string;
        returnAfterStart: string;
      };
    };
    openrouter: {
      intro: string;
      steps: {
        signup: string;
        createKey: string;
        pasteKey: string;
      };
    };
    noInstructions: string;
    okButton: string;
  };

  sidebar: {
    newConversationTitle: string;
    workspaceAssetsTitle: string;
    assetsLabel: string;
  };

  renamingPopup: {
    newNameLabel: string;
    newNamePlaceholder: string;
  };

  wizards: {
    freshStartTitle: string;
    freshStartSubtitle: string;
    freshStartDescription: string;
    workspaceTitle: string;
    workspaceDescription: string;
    spaceSetupNameTitle: string;
    spaceSetupNameLabel: string;
    spaceSetupNameDescription: string;
    spaceSetupNamePlaceholder: string;
    spaceSetupNameHint: string;
    spaceSetupBrainsTitle: string;
    spaceSetupBrainsDescription: string;
    spaceSetupBrainsStepTitle: string;
    spaceSetupThemeStepTitle: string;
    spaceSetupLookTitle: string;
    colorSchemeLabel: string;
    themeLabel: string;
  };

  noTabs: {
    setupBrainsTitle: string;
    setupBrainsDescription: string;
    readyToStartMessage: string;
    newConversationTitle: string;
    startConversationButton: string;
    chatTitle: string;
    todoNewThread: string;
  };

  devPanel: {
    desktopUpdatesTitle: string;
    currentVersionLabel: string;
    desktopUpdatesOnly: string;
    exitDevMode: string;
    devModeStatus: (version: string) => string;
    openSpaceInspector: string;
    closeSpaceInspector: string;
    versionLabel: string;
    shellLabel: string;
    clientLabel: string;
    updatesLabel: string;
    checkingUpdates: string;
    checkForUpdates: string;
  };

  fileViewer: {
    loading: string;
    noContent: string;
  };

  chat: {
    assistantConfigIdLabel: string;
    unknown: string;
    unknownError: string;
    aiLabel: string;
    processing: string;
    messageInfoAssistant: string;
    messageInfoModel: string;
    messageInfoCreated: string;
    messageInfoUpdated: string;
    messageInfoAria: string;
    thinking: string;
    acting: string;
    thoughtActed: string;
    acted: string;
    thought: string;
    errorLoadingAppTree: string;
    viewFilesAria: string;
    scrollToBottomAria: string;
    chatFilesTitle: string;
  };

  chatControls: {
    copyMessage: string;
    editMessage: string;
    rerunInNewBranch: string;
  };

  fileMention: {
    noFilesFound: string;
    loading: string;
    previewNotFound: string;
    previewResolveFailed: string;
    previewUnknownError: string;
  };

  filesApp: {
    filesRootNotFound: string;
    uploadFiles: string;
    uploading: string;
    newFolder: string;
    emptyFolderPrefix: string;
    emptyFolderUpload: string;
    emptyFolderOr: string;
    emptyFolderMove: string;
    emptyFolderSuffix: string;
    errorLoadingFilesRoot: string;
    filesAndFoldersLabel: string;
    workspaceLabel: string;
    unnamedLabel: string;
    untitledLabel: string;
    moreItems: (count: number) => string;
  };

  attachments: {
    addAttachmentsAria: string;
    uploadPhotosFiles: string;
    browseWorkspaceFiles: string;
    setupProviderMessage: string;
    setupBrainsButton: string;
    processingImage: string;
    processingTextFile: string;
    linesLabel: string;
    wordsLabel: string;
    removeAttachmentAria: string;
  };

  files: {
    loadingFile: string;
    noFileData: string;
    loadingPdf: string;
    pdfLoadFailed: string;
    invalidReference: string;
    failedToLoad: string;
    failedToLoadWithMessage: (message: string) => string;
    unknownError: string;
  };

  spaceInspector: {
    spaceLabel: string;
    openCurrentAppTree: string;
    appTreeLabel: string;
    toggleExpandAria: string;
    childrenLabel: string;
    addVertexAria: string;
    deleteVertexAria: string;
    addPropertyLabel: string;
    propertyKeyPlaceholder: string;
    valuePlaceholder: string;
    typeString: string;
    typeNumber: string;
    typeBoolean: string;
    createProperty: string;
    createdAtLabel: string;
    appTreePropertyLabel: string;
    windowAriaLabel: string;
    windowTitle: string;
    dragWindowAria: string;
    resizeWindowAria: string;
  };

  spacesList: {
    newSpaceLabel: string;
    localSpaceLabel: string;
    noSpacesFound: string;
  };

  auth: {
    serversOfflineTitle: string;
    serversOfflineMessage: string;
    continueWithGoogle: string;
    continueWithGithub: string;
    continueWithGithubComingSoon: string;
    continueWithX: string;
    continueWithXComingSoon: string;
    signInTitle: string;
    signInAction: string;
    profileTitle: string;
    signOut: string;
    userAvatarAlt: string;
    userFallbackName: string;
    googleAlt: string;
    githubAlt: string;
    xAlt: string;
  };

  updates: {
    updatesTitle: string;
    checkForUpdates: string;
    checkingForUpdates: string;
    checkingLabel: string;
    downloadKindClientBuild: string;
    downloadKindElectron: string;
    downloadKindUpdate: string;
    downloadingLabel: (kind: string, version: string | null) => string;
    downloadedLabel: string;
    failedLabel: string;
  };

  workspaceCreate: {
    title: string;
    nameLabel: string;
    namePlaceholder: string;
    nameEmptyError: string;
    nameUnsupportedError: string;
    nameAlreadyExistsError: string;
    nameAlreadyExistsInline: string;
    nameDescription: string;
    newWorkspaceLocationLabel: string;
    selectLocationPlaceholder: string;
    changeLocation: string;
    creating: string;
    createWorkspace: string;
    chooseLocationTitle: string;
    folderAlreadyUsedTitle: string;
    folderAlreadyUsedMessage: string;
    failedAccessFolderTitle: string;
    failedAccessFolderMessage: string;
    failedAccessFolderUnknown: string;
    chooseFolderError: string;
    cannotUseFolderTitle: string;
    cannotUseFolderMessage: string;
    failedCreateWorkspaceTitle: string;
    failedCreateWorkspaceMessage: string;
    failedCreateWorkspaceFallback: string;
    defaultFolderName: string;
    presetNames: string[];
  };

  filePicker: {
    workspaceFilesUnavailable: string;
    workspaceFilesTitle: string;
  };

  appTreeMenu: {
    openInNewTab: string;
  };

  spaceEntry: {
    initializationError: string;
  };

  tabs: {
    closeTab: string;
    startNewConversation: string;
    newConversationShortcut: string;
  };
}
