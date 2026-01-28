import type { Texts } from "../texts";

export const malayTexts: Partial<Texts> = {
  basics: {
    name: "Nama",
    button: "Butang",
    description: "Perihalan",
    instructions: "Arahan",
    optional: "Pilihan",
    loading: "Memuatkan...",
    thinking: "Sedang berfikir...",
    model: "Model",
    apps: "Pembantu",
  },

  messageForm: {
    placeholder: "Tanya apa sahaja",
    attachFile: "Lampirkan fail",
    send: "Hantar",
    stop: "Hentikan penjanaan"
  },

  appPage: {
    title: "Pembantu",
    buttonNewConfig: "Pembantu baharu",
    chatsTitle: "Pembantu anda",
    description: "Anda boleh cipta dan edit pembantu sembang di sini. Butang pembantu akan muncul di bahagian kanan atas bar sisi.",
    contactMessage: "Keupayaan untuk mencipta jenis aplikasi lain akan datang kemudian. Tulis kepada <a class=\"anchor\" href=\"mailto:d@dkury.com\">d@dkury.com</a> jika anda ada idea atau cadangan."
  },

  appConfigPage: {
    newConfigTitle: "Pembantu baharu",
    editConfigTitle: "Edit pembantu",
    defaultConfigTitle: "Pembantu lalai",
    editAssistantTitle: "Edit pembantu",
    editAssistantButton: "Edit pembantu",
    startChatTitle: "Mulakan sembang",
    startChatDescription: "Mulakan sembang dengan pembantu ini",
    dragToReorder: "Seret untuk menyusun semula (belum disokong)",
    newConfigButton: "Butang thread baharu (pilihan)",
    buttonCreate: "Cipta",
    buttonSave: "Simpan perubahan",
    namePlaceholder: "Namakan pembantu",
    descriptionPlaceholder: "Perihalan ringkas tentang pembantu ini",
    instructionsPlaceholder:
      "Mulakan dengan 'Anda ialah ...'. Beri arahan AI seperti melatih pekerja baharu",
    buttonPlaceholder: "Teks tindakan ringkas untuk butang",
    gotoNewConfig: "Pergi sini jika anda mahu cipta pembantu baharu",
    errorValidationRequired: "Medan ini wajib diisi",
    errorAppConfigLoadFailure: "Gagal memuat konfigurasi pembantu",
    tableCell: {
      deleteButton: "Padam",
      visibilityLabel: "Tunjukkan/sembunyikan pembantu di bar sisi",
      deleteLabel: "Padam konfigurasi pembantu"
    },
    defaultConfigMessage: "Ini ialah konfigurasi pembantu sembang lalai. Anda boleh menukar model AI atau cipta pembantu baharu.",
    defaultConfigGotoNew: "Pembantu baharu",
    description: "Anda boleh cipta prompt sistem (arahan) sendiri berdasarkan pembantu lalai. Versi akan datang akan menyokong jenis aplikasi lain dengan alat dan API luaran.",
  },

  defaultAppConfig: {
    name: "Sembang",
    button: "Soalan baharu",
    description: "Pembantu sembang asas",
    instructions:
      "Anda ialah Sila, pembantu AI. Jawab secara terus. Gunakan bahasa yang mudah. Elakkan basa-basi, kata pengisi, dan formaliti.",
  },

  appConfigDropdown: {
    placeholder: "Pilih pembantu...",
    newAssistant: "Pembantu baharu",
    editConfigTitle: "Edit konfigurasi",
    editAssistantLabel: (assistantName: string) => `Edit pembantu "${assistantName}"`
  },

  modelSelection: {
    manageProviders: "Urus penyedia model",
    done: "Selesai",
    backToSelection: "Kembali ke pemilihan model"
  },

  settingsPage: {
    title: "Tetapan",
    appearance: {
      title: "Penampilan",
      theme: "Tema",
      themeDescription: "Pilih tema warna untuk ruang kerja anda.",
      language: "Bahasa",
      colorScheme: "Skema warna",
      system: "Sistem",
      dark: "Gelap",
      light: "Cerah",
      switchToLightMode: "Tukar ke mod cerah",
      switchToDarkMode: "Tukar ke mod gelap"
    },
    providers: {
      title: "Penyedia model",
      description: "Sambungkan penyedia model AI untuk menggerakkan pembantu anda. Ini ialah otak pembantu. Kami syorkan menyiapkan OpenAI, Anthropic, atau Google dahulu."
    },
    sidebar: {
      workspaceTitle: "Ruang kerja",
      workspacePreferencesTitle: "Keutamaan ruang kerja",
      workspacePreferencesLabel: "Keutamaan",
      appTitle: "Aplikasi"
    },
    aboutSila: {
      title: "Tentang Sila",
      websiteLinkLabel: "Laman web",
      docsLinkLabel: "Dokumentasi"
    },
    workspacePreferences: {
      description: "Terangkan ruang kerja kepada AI dan pilih bahasa UI serta AI.",
      descriptionLabel: "Perihalan ruang kerja",
      descriptionPlaceholder: "Terangkan tujuan ruang kerja ini atau keutamaan pembantu dengan bahasa mudah.",
      storedPathLabel: "Ruang kerja ini disimpan di:",
      revealButton: "Tunjuk",
      noWorkspaceLoaded: "Tiada ruang kerja dimuatkan.",
      notStoredOnDiskError: "Ruang kerja ini tidak disimpan pada cakera.",
      revealUnsupportedError: "Tunjuk tidak disokong dalam binaan ini.",
      revealFailedError: "Gagal memaparkan laluan ruang kerja."
    },
    workspacePrivacySync: {
      storageTitle: "Storan",
      workspaceLocationLabel: "Lokasi ruang kerja:",
      noWorkspaceLoaded: "Tiada ruang kerja dimuatkan.",
      syncPlaceholder: "Tetapan penyegerakan akan datang tidak lama lagi."
    },
    personalization: {
      title: "Profil pengguna",
      description: "Butiran profil dan keutamaan peribadi akan datang tidak lama lagi.",
      openProfile: "Buka profil",
      signInPlaceholder: "Pilihan log masuk akan muncul apabila autentikasi diaktifkan."
    },
    spaces: {
      title: "Ruang kerja",
      spaceCount: (count: number) => `Anda mempunyai ${count === 1 ? '1 ruang kerja' : `${count} ruang kerja`}`,
      manageButton: "Urus"
    },
    developers: {
      title: "Untuk pembangun",
      toggleDevMode: "Hidup/matikan Mod Dev"
    }
  },

  spacesPage: {
    title: "Ruang kerja anda",
    description: "Ruang kerja ialah tempat data aplikasi AI anda disimpan. Anda boleh mempunyai beberapa ruang kerja dan bertukar dengan cepat. Contohnya satu untuk kerja dan satu untuk peribadi.",
    opener: {
      createTitle: "Cipta ruang kerja baharu",
      createDescription: "Pilih folder untuk ruang kerja baharu anda. Boleh jadi folder tempatan atau folder yang disegerakkan dengan iCloud, Dropbox, Google Drive, dan lain-lain.",
      createButton: "Cipta",
      openTitle: "Buka ruang kerja",
      openDescription: "Buka folder yang mengandungi ruang kerja anda.",
      openButton: "Buka",
      errorCreate: "Gagal mencipta ruang kerja",
      errorOpen: "Gagal membuka ruang kerja",
      errorOpenTitle: "Gagal membuka space",
      errorOpenUnknown: "Ralat tidak diketahui berlaku semasa membuka space.",
      dialogCreateTitle: "Pilih folder untuk ruang kerja baharu",
      dialogOpenTitle: "Pilih folder yang mengandungi ruang kerja"
    },
    openerPageTitle: "Cipta atau buka ruang kerja anda",
    openerPageDescription: "Anda boleh cipta ruang kerja baharu atau buka yang sedia ada.",
    addWorkspaceButton: "Tambah ruang kerja",
    defaultWorkspaceName: "Ruang kerja",
    manageWorkspacesButton: "Urus ruang kerja"
  },

  actions: {
    open: "Buka",
    edit: "Edit",
    delete: "Padam",
    done: "Selesai",
    cancel: "Batal",
    confirm: "Sahkan",
    close: "Tutup",
    copy: "Salin",
    add: "Tambah",
    update: "Kemas kini",
    save: "Simpan",
    saving: "Menyimpan...",
    change: "Tukar",
    choose: "Pilih",
    retry: "Cuba lagi",
    rename: "Tukar nama",
    removeFromList: "Buang daripada senarai",
    openInNewTab: "Buka di tab baharu",
    duplicate: "Gandakan",
    connect: "Sambungkan",
    disconnect: "Putuskan",
    configure: "Konfigurasi",
    how: "Bagaimana?",
    attach: "Lampir",
    ok: "OK",
    goBack: "Kembali",
    closeAll: "Tutup semua",
    back: "Kembali",
    next: "Seterusnya",
    finish: "Selesai"
  },

  markdownTextDocument: {
    openButton: "Buka",
    loading: "Memuatkan dokumen...",
    loadError: "Tidak dapat memuat kandungan fail.",
    openAriaLabel: (fileName: string) => `Buka dokumen: ${fileName}`
  },

  markdownImage: {
    openImageAria: (fileName: string) => `Buka imej: ${fileName}`,
    failedToLoad: (fileUrl: string) => `Gagal memuat fail: ${fileUrl}`
  },

  models: {
    auto: "Auto",
    selectModelTitle: "Pilih model",
    chooseModelRequired: "Pilih model",
    invalidModelFormat: (value: string) => `Format model tidak sah: ${value}`,
    unknownProvider: (providerId: string) => `Penyedia tidak diketahui: ${providerId}`,
    enterModel: "Masukkan model",
    chooseModel: "Pilih model",
    modelNameLabel: "Nama model",
    openRouterPlaceholder: "contohnya: openai/gpt-4o, anthropic/claude-3-5-sonnet",
    openRouterHelp: "Masukkan mana-mana model yang tersedia di OpenRouter (contohnya: openai/gpt-4o, anthropic/claude-3-5-sonnet, meta-llama/llama-3.2-90b-vision-instruct)",
    defaultOption: (label: string) => `${label} (lalai)`
  },

  providers: {
    connected: "Bersambung",
    validationFailed: "Pengesahan gagal. Semak API key atau sambungan anda.",
    apiKeyValidationFailed: "Pengesahan API key gagal. Kunci mungkin tidak sah atau telah tamat tempoh.",
    unknownError: "Ralat tidak diketahui berlaku",
    connectionFailed: "Sambungan gagal. Sila semak rangkaian anda.",
    editTitle: "Edit penyedia",
    deleteTitle: "Padam penyedia",
    deletePrompt: "Padam?",
    visitWebsiteTitle: "Lawati laman penyedia"
  },

  customProviderSetup: {
    titleAdd: "Tambah penyedia tersuai",
    titleEdit: "Edit penyedia tersuai",
    labelProviderName: "Nama penyedia",
    labelBaseApiUrl: "URL API asas",
    labelApiKey: "API Key",
    labelModelId: "Model ID",
    labelCustomHeaders: "Header tersuai (pilihan)",
    placeholderName: "Penyedia tersuai saya",
    placeholderBaseApiUrl: "https://api.example.com/v1",
    placeholderApiKey: "sk-...",
    placeholderModelId: "gpt-3.5-turbo",
    placeholderHeaders: "Authorization: Bearer token\nX-Custom-Header: value",
    headersHint: "Satu header setiap baris dalam format 'key: value'",
    invalidHeadersFormat: "Format header tersuai tidak sah. Gunakan 'key: value', satu setiap baris.",
    saveError: "Gagal menyimpan konfigurasi penyedia",
    addModalTitle: "Tambah penyedia tersuai gaya OpenAI",
    addButton: "Tambah penyedia tersuai"
  },

  customProviderForm: {
    titleAdd: "Tambah penyedia serasi OpenAI",
    titleEdit: "Edit penyedia serasi OpenAI",
    labelProviderName: "Nama penyedia*",
    labelApiUrl: "URL API*",
    labelApiKey: "API Key*",
    labelModelId: "Model ID*",
    labelCustomHeaders: "Header tersuai (pilihan)",
    placeholderName: "Penyedia tersuai saya",
    placeholderApiUrl: "https://api.example.com/v1",
    placeholderApiKey: "sk-...",
    placeholderModelId: "gpt-3.5-turbo",
    placeholderHeaders: "Authorization: Bearer token\nContent-Type: application/json",
    hintBaseUrl: "URL asas untuk panggilan API, mesti serasi dengan OpenAI API",
    hintModelId: "Nyatakan model ID yang diperlukan oleh penyedia ini",
    hintHeaders: "Masukkan satu header setiap baris dalam format \"Key: Value\"",
    validationNameRequired: "Nama penyedia diperlukan",
    validationApiUrlRequired: "URL API diperlukan",
    validationApiUrlInvalid: "Format URL API tidak sah",
    validationApiKeyRequired: "API key diperlukan",
    validationModelIdRequired: "Model ID diperlukan",
    saveFailed: (message: string) => `Gagal menyimpan: ${message}`,
    buttonUpdate: "Kemas kini penyedia",
    buttonAddProvider: "Tambah penyedia"
  },
  modelProviderSetup: {
    title: (providerName: string) => `Cara menyediakan ${providerName}`,
    openai: "Anda perlu memasukkan kunci untuk menggunakan model OpenAI.\n\n1. Daftar atau log masuk di [platform.openai.com](https://platform.openai.com).\n2. Tambah kredit pada baki di [platform.openai.com/settings/organization/billing/overview](https://platform.openai.com/settings/organization/billing/overview).\n3. Cipta kunci rahsia baharu di [platform.openai.com/api-keys](https://platform.openai.com/api-keys).\n4. Tampal kunci di sini dan tunggu pengesahan.",
    anthropic: "Anda perlu memasukkan kunci untuk menggunakan model Anthropic.\n\n1. Daftar atau log masuk di [console.anthropic.com](https://console.anthropic.com/).\n2. Cipta kunci baharu di [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys).\n3. Tampal kunci di sini dan tunggu pengesahan.",
    groq: "Anda perlu memasukkan kunci untuk menggunakan model Groq.\n\n1. Daftar atau log masuk di [console.groq.com](https://console.groq.com/).\n2. Cipta kunci API di [console.groq.com/keys](https://console.groq.com/keys).\n3. Tampal kunci di sini dan tunggu pengesahan.",
    deepseek: "Anda perlu memasukkan kunci untuk menggunakan model DeepSeek.\n\n1. Daftar atau log masuk di [platform.deepseek.com](https://platform.deepseek.com/).\n2. Cipta kunci API di [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys).\n3. Tampal kunci di sini dan tunggu pengesahan.",
    google: "Anda perlu memasukkan kunci untuk menggunakan model Google Gemini.\n\n1. Daftar atau log masuk di [aistudio.google.com](https://aistudio.google.com/).\n2. Cipta kunci API di [aistudio.google.com/app/api-keys](https://aistudio.google.com/app/api-keys).\n3. Tampal kunci di sini dan tunggu pengesahan.",
    xai: "Anda perlu memasukkan kunci untuk menggunakan model xAI.\n\n1. Daftar atau log masuk di [console.x.ai](https://console.x.ai/).\n2. Cipta pasukan dan pergi ke halaman kunci API.\n3. Tampal kunci di sini dan tunggu pengesahan.",
    cohere: "Anda perlu memasukkan kunci untuk menggunakan model Cohere.\n\n1. Daftar atau log masuk di [dashboard.cohere.com](https://dashboard.cohere.com/).\n2. Cipta kunci API di [dashboard.cohere.com/api-keys](https://dashboard.cohere.com/api-keys).\n3. Tampal kunci di sini dan tunggu pengesahan.",
    mistral: "Anda perlu memasukkan kunci untuk menggunakan model Mistral.\n\n1. Daftar atau log masuk di [console.mistral.ai](https://console.mistral.ai/).\n2. Cipta kunci API di [console.mistral.ai/api-keys](https://console.mistral.ai/api-keys/).\n3. Tampal kunci di sini dan tunggu pengesahan.",
    ollama: "Anda perlu memasang dan menjalankan Ollama untuk menggunakan modelnya. Anda boleh menjalankannya secara tempatan dan Sila akan menyambung.\n\n1. Muat turun Ollama dari [ollama.com](https://ollama.com/).\n2. Pasang Ollama dan sediakan model yang ingin anda gunakan.\n3. Kembali ke sini selepas menjalankannya.",
    openrouter: "Anda perlu memasukkan kunci untuk menggunakan API bersatu OpenRouter bagi mengakses ratusan model AI.\n\n1. Daftar atau log masuk di [openrouter.ai](https://openrouter.ai/).\n2. Pergi ke tetapan akaun anda dan cipta kunci API baharu.\n3. Tampal kunci di sini dan tunggu pengesahan.",
    exa: "Anda perlu memasukkan kunci untuk menggunakan API carian Exa.\n\n1. Daftar atau log masuk di [exa.ai](https://exa.ai/).\n2. Cipta kunci API dalam papan pemuka Exa anda.\n3. Tampal kunci di sini dan tunggu pengesahan.",
    falai: "Anda perlu memasukkan kunci untuk menggunakan API Fal.ai.\n\n1. Daftar atau log masuk di [fal.ai](https://fal.ai/).\n2. Cipta kunci API dalam papan pemuka Fal.ai anda.\n3. Tampal kunci di sini dan tunggu pengesahan.",
    noInstructions: "Tiada arahan penyediaan untuk penyedia ini.",
    okButton: "OK"
  },



  sidebar: {
    newConversationTitle: "Perbualan baharu",
    workspaceAssetsTitle: "Aset ruang kerja",
    assetsLabel: "Aset"
  },

  chatSearch: {
    openButtonLabel: "Cari sembang",
    openButtonAria: "Cari sembang",
    inputPlaceholder: "Cari sembang...",
    closeAriaLabel: "Tutup carian",
    indexingLabel: "Mengindeks sembang…",
    recentTitle: "7 hari lepas",
    noRecentConversations: "Tiada perbualan terkini.",
    noResults: "Tiada hasil."
  },

  renamingPopup: {
    newNameLabel: "Nama baharu",
    newNamePlaceholder: "Masukkan nama baharu"
  },

  wizards: {
    freshStartTitle: "Selamat datang ke Sila",
    freshStartSubtitle: "Cipta atau buka ruang kerja",
    freshStartDescription: "Sila berfungsi seperti ChatGPT, tetapi di Sila anda memiliki pembantu, perbualan, dan semua data yang dijana. Lebih anda gunakan AI, data itu menjadi lebih bernilai, jadi wajar untuk memilikinya sendiri.",
    getStartedButton: "Mulakan",
    workspaceTitle: "Cipta atau buka ruang kerja",
    workspaceDescription: "Ruang kerja ialah tempat perbualan, fail, dan pembantu anda disimpan. Anda boleh mempunyai beberapa ruang kerja dan bertukar dengan cepat.",
    spaceSetupNameTitle: "Namakan ruang kerja",
    spaceSetupNameLabel: "Nama ruang kerja",
    spaceSetupNameDescription: "Beri nama untuk mudah dikenal pasti, atau langkau untuk guna nama lalai. Anda boleh ubah kemudian.",
    spaceSetupNamePlaceholder: "Ruang Kerja Saya",
    spaceSetupNameHint: "Anda boleh beri nama ringkas yang menerangkan tujuan ruang kerja:",
    spaceSetupBrainsTitle: "Sediakan otak untuk ruang kerja",
    spaceSetupBrainsDescription: "Sambungkan sekurang-kurangnya satu penyedia model AI untuk mula menggunakan Sila. Kami syorkan OpenAI, Anthropic, atau Google dahulu.",
    spaceSetupBrainsStepTitle: "Otak",
    spaceSetupSearchTitle: "Sediakan carian untuk ruang kerja (pilihan)",
    spaceSetupSearchDescription: "Sambungkan penyedia carian supaya pembantu boleh mencari web. Ini pilihan dan anda boleh langkau.",
    spaceSetupSearchStepTitle: "Carian",
    spaceSetupThemeStepTitle: "Tema",
    spaceSetupLookTitle: "Pilih rupa ruang kerja",
    colorSchemeLabel: "Skema warna",
    themeLabel: "Tema"
  },

  noTabs: {
    setupBrainsTitle: "Sediakan otak untuk Sila",
    setupBrainsDescription: "Mari sediakan sekurang-kurangnya satu penyedia model AI untuk mula menggunakan Sila. Kami syorkan OpenAI, Anthropic, atau Google dahulu kerana modelnya paling berkuasa.",
    readyToStartMessage: "Sekurang-kurangnya satu penyedia sudah disediakan, jadi kita boleh mulakan perbualan baharu",
    newConversationTitle: "Perbualan baharu",
    startConversationButton: "Mulakan perbualan",
    chatTitle: "Sembang",
    todoNewThread: "@TODO: tambah thread baharu di sini"
  },

  devPanel: {
    desktopUpdatesTitle: "Kemas Kini Desktop",
    currentVersionLabel: "Versi semasa:",
    desktopUpdatesOnly: "Kemas kini desktop hanya tersedia dalam aplikasi desktop.",
    exitDevMode: "Keluar Mod Dev",
    devModeStatus: (version: string) => `🚧 Sila ${version} dalam Mod Dev`,
    openSpaceInspector: "Buka Space Inspector",
    closeSpaceInspector: "Tutup Space Inspector",
    versionLabel: "Versi",
    shellLabel: "Shell",
    clientLabel: "Client",
    updatesLabel: "Kemas kini",
    checkingUpdates: "Sedang menyemak...",
    checkForUpdates: "Semak kemas kini"
  },

  fileViewer: {
    loading: "Memuatkan...",
    noContent: "Tiada kandungan untuk dipaparkan."
  },

  chat: {
    assistantConfigIdLabel: "configId pembantu:",
    unknown: "tidak diketahui",
    unknownError: "Ralat tidak diketahui",
    aiLabel: "AI",
    processing: "Memproses",
    messageInfoAssistant: "Pembantu:",
    messageInfoModel: "Model:",
    messageInfoCreated: "Dibuat:",
    messageInfoUpdated: "Dikemas kini:",
    messageInfoAria: "Info mesej",
    thinking: "Sedang berfikir",
    acting: "Bertindak",
    thoughtActed: "Berfikir, bertindak",
    acted: "Bertindak",
    thought: "Berfikir",
    errorLoadingAppTree: "Ralat memuat app tree",
    viewFilesAria: "Lihat fail sembang",
    scrollToBottomAria: "Skrol ke bawah",
    chatFilesTitle: "Fail sembang",
    dropFilesAria: "Lepaskan fail untuk lampirkan",
    dropFilesTitle: "Lepaskan fail untuk lampirkan"
  },

  chatControls: {
    copyMessage: "Salin mesej",
    editMessage: "Edit mesej",
    rerunInNewBranch: "Jalankan semula dalam cabang baharu"
  },

  fileMention: {
    noFilesFound: "Tiada fail ditemui",
    loading: "Memuatkan...",
    previewNotFound: "Fail tidak ditemui",
    previewResolveFailed: "Gagal mendapatkan fail",
    previewUnknownError: "Ralat tidak diketahui"
  },

  filesApp: {
    filesRootNotFound: "Akar fail tidak ditemui.",
    uploadFiles: "Muat naik fail",
    uploading: "Sedang memuat naik...",
    newFolder: "Folder baharu",
    emptyFolderPrefix: "Anda boleh",
    emptyFolderUpload: "muat naik",
    emptyFolderOr: "atau",
    emptyFolderMove: "pindahkan",
    emptyFolderSuffix: "fail ke folder ini.",
    errorLoadingFilesRoot: "Ralat memuat akar fail",
    filesAndFoldersLabel: "Fail dan folder",
    workspaceLabel: "Ruang kerja",
    unnamedLabel: "Tanpa nama",
    untitledLabel: "Tiada tajuk",
    moreItems: (count: number) => `+ ${count} lagi…`
  },

  attachments: {
    addAttachmentsAria: "Tambah lampiran (atau tampal fail)",
    uploadPhotosFiles: "Muat naik foto & fail",
    browseWorkspaceFiles: "Layari fail ruang kerja",
    setupProviderMessage: "Sediakan penyedia model untuk berbual dengan AI.",
    setupBrainsButton: "Sediakan otak",
    processingImage: "Memproses imej...",
    processingTextFile: "Memproses fail teks...",
    linesLabel: "baris",
    wordsLabel: "perkataan",
    removeAttachmentAria: "Buang lampiran"
  },

  files: {
    loadingFile: "Memuatkan...",
    noFileData: "Tiada data fail",
    loadingPdf: "Memuatkan PDF...",
    pdfLoadFailed: "Gagal memuat PDF",
    invalidReference: "Rujukan fail tidak sah",
    failedToLoad: "Gagal memuat fail",
    failedToLoadWithMessage: (message: string) => `Gagal memuat fail: ${message}`,
    unknownError: "Ralat tidak diketahui"
  },

  spaceInspector: {
    spaceLabel: "Space",
    openCurrentAppTree: "Buka App Tree semasa",
    appTreeLabel: "App Tree",
    toggleExpandAria: "Togol kembangkan",
    childrenLabel: "anak:",
    addVertexAria: "Tambah vertex baharu",
    deleteVertexAria: "Padam vertex",
    addPropertyLabel: "Tambah sifat",
    propertyKeyPlaceholder: "Kunci sifat",
    valuePlaceholder: "Nilai",
    typeString: "Rentetan",
    typeNumber: "Nombor",
    typeBoolean: "Boolean",
    createProperty: "Cipta",
    createdAtLabel: "dicipta",
    appTreePropertyLabel: "app tree",
    windowAriaLabel: "Tetingkap Space Inspector",
    windowTitle: "Space Inspector",
    dragWindowAria: "Seret tetingkap",
    resizeWindowAria: "Ubah saiz tetingkap"
  },

  spacesList: {
    newSpaceLabel: "Space baharu",
    localSpaceLabel: "Space tempatan",
    noSpacesFound: "Tiada space ditemui"
  },

  auth: {
    serversOfflineTitle: "Pelayan sedang offline",
    serversOfflineMessage: "Gunakan mod lokal jika anda mahu menguji",
    continueWithGoogle: "Teruskan dengan Google",
    continueWithGithub: "Teruskan dengan Github",
    continueWithGithubComingSoon: "Teruskan dengan Github (Akan Datang)",
    continueWithX: "Teruskan dengan X",
    continueWithXComingSoon: "Teruskan dengan X (Akan Datang)",
    signInTitle: "Log masuk",
    signInAction: "Log masuk",
    profileTitle: "Profil",
    signOut: "Log keluar",
    userAvatarAlt: "Avatar pengguna",
    userFallbackName: "Pengguna",
    googleAlt: "Google",
    githubAlt: "Github",
    xAlt: "X"
  },

  updates: {
    updatesTitle: "Kemas kini",
    checkForUpdates: "Semak kemas kini",
    checkingForUpdates: "Sedang menyemak...",
    checkingLabel: "Sedang menyemak kemas kini…",
    downloadKindClientBuild: "binaan klien",
    downloadKindElectron: "electron",
    downloadKindUpdate: "kemas kini",
    downloadingLabel: (kind: string, version: string | null) => {
      const suffix = version ? ` (${version})` : "";
      return `Sedang memuat turun ${kind}${suffix}…`;
    },
    downloadedLabel: "Kemas kini telah dimuat turun.",
    failedLabel: "Kemas kini gagal."
  },

  workspaceCreate: {
    title: "Namakan ruang kerja",
    nameLabel: "Nama ruang kerja",
    namePlaceholder: "Ruang Kerja Saya",
    nameEmptyError: "Nama ruang kerja tidak boleh kosong.",
    nameUnsupportedError: "Nama ruang kerja mengandungi aksara tidak disokong.",
    nameAlreadyExistsError: "Folder dengan nama ini sudah wujud di lokasi yang dipilih.",
    nameAlreadyExistsInline: "Ruang kerja dengan nama ini sudah wujud dalam folder yang dipilih.",
    nameDescription: "Anda boleh beri nama ringkas yang menerangkan tujuan ruang kerja:",
    newWorkspaceLocationLabel: "Ruang kerja baharu akan dicipta di:",
    selectLocationPlaceholder: "Pilih lokasi",
    changeLocation: "Tukar lokasi",
    creating: "Sedang mencipta...",
    createWorkspace: "Cipta ruang kerja",
    chooseLocationTitle: "Pilih lokasi untuk mencipta ruang kerja",
    folderAlreadyUsedTitle: "Folder sudah digunakan",
    folderAlreadyUsedMessage: "Pilih folder di luar ruang kerja yang sedia ada.",
    failedAccessFolderTitle: "Gagal mengakses folder",
    failedAccessFolderMessage: "Kami tidak dapat mengakses folder yang dipilih.",
    failedAccessFolderUnknown: "Ralat tidak diketahui berlaku semasa memilih folder.",
    chooseFolderError: "Pilih folder untuk menyimpan ruang kerja.",
    cannotUseFolderTitle: "Tidak boleh gunakan folder ini",
    cannotUseFolderMessage: "Pilih lokasi lain untuk ruang kerja anda.",
    failedCreateWorkspaceTitle: "Gagal mencipta ruang kerja",
    failedCreateWorkspaceMessage: "Kami tidak dapat mencipta ruang kerja.",
    failedCreateWorkspaceFallback: "Gagal mencipta ruang kerja.",
    defaultFolderName: "ruang kerja baharu",
    presetNames: ["Peribadi", "Kerja", "Pengajian", "Sekolah"]
  },

  filePicker: {
    workspaceFilesUnavailable: "Fail ruang kerja tidak tersedia.",
    workspaceFilesTitle: "Fail ruang kerja"
  },

  appTreeMenu: {
    openInNewTab: "Buka di tab baharu"
  },

  spaceEntry: {
    initializationError: "Ralat inisialisasi"
  },

  tabs: {
    closeTab: "Tutup tab",
    startNewConversation: "Mulakan perbualan baharu",
    newConversationShortcut: "Perbualan baharu (Cmd/Ctrl + N)"
  }
};
