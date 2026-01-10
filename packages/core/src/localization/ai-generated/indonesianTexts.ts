import type { Texts } from "../texts";

export const indonesianTexts: Partial<Texts> = {
  basics: {
    name: "Nama",
    button: "Tombol",
    description: "Deskripsi",
    instructions: "Instruksi",
    optional: "Opsional",
    loading: "Memuat...",
    thinking: "Sedang berpikir...",
    model: "Model",
    apps: "Asisten",
  },

  messageForm: {
    placeholder: "Tanyakan apa saja",
    attachFile: "Lampirkan file",
    send: "Kirim",
    stop: "Hentikan pembuatan"
  },

  appPage: {
    title: "Asisten",
    buttonNewConfig: "Asisten baru",
    chatsTitle: "Asisten Anda",
    description: "Anda dapat membuat dan mengedit asisten chat di sini. Tombol asisten akan muncul di kanan atas sidebar.",
    contactMessage: "Kemampuan membuat jenis aplikasi lain akan hadir nanti. Tulis ke <a class=\"anchor\" href=\"mailto:d@dkury.com\">d@dkury.com</a> jika Anda punya ide atau saran."
  },

  appConfigPage: {
    newConfigTitle: "Asisten baru",
    editConfigTitle: "Edit asisten",
    defaultConfigTitle: "Asisten default",
    editAssistantTitle: "Edit asisten",
    editAssistantButton: "Edit asisten",
    startChatTitle: "Mulai chat",
    startChatDescription: "Mulai chat dengan asisten ini",
    dragToReorder: "Seret untuk mengurutkan (belum tersedia)",
    newConfigButton: "Tombol thread baru (opsional)",
    buttonCreate: "Buat",
    buttonSave: "Simpan perubahan",
    namePlaceholder: "Beri nama asisten",
    descriptionPlaceholder: "Deskripsi singkat tentang asisten ini",
    instructionsPlaceholder:
      "Mulai dengan 'Anda adalah ...'. Instruksikan AI seperti Anda melatih karyawan baru",
    buttonPlaceholder: "Teks aksi singkat untuk tombol",
    gotoNewConfig: "Masuk ke sini jika ingin membuat asisten baru",
    errorValidationRequired: "Kolom ini wajib diisi",
    errorAppConfigLoadFailure: "Gagal memuat konfigurasi asisten",
    tableCell: {
      deleteButton: "Hapus",
      visibilityLabel: "Tampilkan/sembunyikan asisten di sidebar",
      deleteLabel: "Hapus konfigurasi asisten"
    },
    defaultConfigMessage: "Ini adalah konfigurasi asisten chat default. Anda dapat mengganti model AI atau membuat asisten baru.",
    defaultConfigGotoNew: "Asisten baru",
    description: "Anda dapat membuat prompt sistem (instruksi) sendiri berdasarkan asisten default. Versi berikutnya akan mendukung jenis aplikasi lain dengan alat dan API eksternal.",
  },

  defaultAppConfig: {
    name: "Chat",
    button: "Pertanyaan baru",
    description: "Asisten chat sederhana",
    instructions:
      "Anda adalah Sila, asisten AI. Jawab secara langsung. Gunakan bahasa sederhana. Hindari basa-basi, kata pengisi, dan formalitas.",
  },

  appConfigDropdown: {
    placeholder: "Pilih asisten...",
    newAssistant: "Asisten baru",
    editConfigTitle: "Edit konfigurasi",
    editAssistantLabel: (assistantName: string) => `Edit asisten "${assistantName}"`
  },

  modelSelection: {
    manageProviders: "Kelola penyedia model",
    done: "Selesai",
    backToSelection: "Kembali ke pemilihan model"
  },

  settingsPage: {
    title: "Pengaturan",
    appearance: {
      title: "Tampilan",
      theme: "Tema",
      themeDescription: "Pilih tema warna untuk workspace Anda.",
      language: "Bahasa",
      colorScheme: "Skema warna",
      system: "Sistem",
      dark: "Gelap",
      light: "Terang",
      switchToLightMode: "Beralih ke mode terang",
      switchToDarkMode: "Beralih ke mode gelap"
    },
    providers: {
      title: "Penyedia model",
      description: "Hubungkan penyedia model AI untuk menjalankan asisten Anda. Ini adalah otak dari asisten. Kami menyarankan menyiapkan OpenAI, Anthropic, atau Google terlebih dahulu."
    },
    sidebar: {
      workspaceTitle: "Workspace",
      workspacePreferencesTitle: "Preferensi workspace",
      workspacePreferencesLabel: "Preferensi",
      appTitle: "Aplikasi"
    },
    aboutSila: {
      title: "Tentang Sila",
      websiteLinkLabel: "Situs web",
      docsLinkLabel: "Dokumentasi"
    },
    workspacePreferences: {
      description: "Jelaskan workspace untuk AI dan pilih bahasa UI serta AI.",
      descriptionLabel: "Deskripsi workspace",
      descriptionPlaceholder: "Jelaskan tujuan workspace ini atau preferensi asisten dengan bahasa sederhana.",
      storedPathLabel: "Workspace ini disimpan di:",
      revealButton: "Tampilkan",
      noWorkspaceLoaded: "Tidak ada workspace yang dimuat.",
      notStoredOnDiskError: "Workspace ini tidak disimpan di disk.",
      revealUnsupportedError: "Fitur tampilkan tidak didukung di build ini.",
      revealFailedError: "Gagal menampilkan path workspace."
    },
    workspacePrivacySync: {
      storageTitle: "Penyimpanan",
      workspaceLocationLabel: "Lokasi workspace:",
      noWorkspaceLoaded: "Tidak ada workspace yang dimuat.",
      syncPlaceholder: "Pengaturan sinkronisasi akan segera hadir."
    },
    personalization: {
      title: "Profil pengguna",
      description: "Detail profil dan preferensi personalisasi akan segera hadir.",
      openProfile: "Buka profil",
      signInPlaceholder: "Opsi masuk akan muncul saat autentikasi diaktifkan."
    },
    spaces: {
      title: "Workspace",
      spaceCount: (count: number) => `Anda memiliki ${count === 1 ? '1 workspace' : `${count} workspace`}`,
      manageButton: "Kelola"
    },
    developers: {
      title: "Untuk pengembang",
      toggleDevMode: "Aktif/nonaktifkan Mode Dev"
    }
  },

  spacesPage: {
    title: "Workspace Anda",
    description: "Workspace adalah tempat data aplikasi AI Anda disimpan. Anda bisa memiliki beberapa workspace dan berpindah dengan cepat. Misalnya, satu untuk kerja dan satu untuk personal.",
    opener: {
      createTitle: "Buat workspace baru",
      createDescription: "Pilih folder untuk workspace baru Anda. Bisa folder lokal atau folder yang disinkronkan dengan iCloud, Dropbox, Google Drive, dll.",
      createButton: "Buat",
      openTitle: "Buka workspace",
      openDescription: "Buka folder yang berisi workspace Anda.",
      openButton: "Buka",
      errorCreate: "Gagal membuat workspace",
      errorOpen: "Gagal membuka workspace",
      errorOpenTitle: "Gagal membuka space",
      errorOpenUnknown: "Terjadi kesalahan tak dikenal saat membuka space.",
      dialogCreateTitle: "Pilih folder untuk workspace baru",
      dialogOpenTitle: "Pilih folder yang berisi workspace"
    },
    openerPageTitle: "Buat atau buka workspace Anda",
    openerPageDescription: "Anda dapat membuat workspace baru atau membuka yang sudah ada.",
    addWorkspaceButton: "Tambahkan workspace",
    defaultWorkspaceName: "Workspace",
    manageWorkspacesButton: "Kelola workspace"
  },

  actions: {
    open: "Buka",
    edit: "Edit",
    delete: "Hapus",
    done: "Selesai",
    cancel: "Batal",
    confirm: "Konfirmasi",
    close: "Tutup",
    copy: "Salin",
    add: "Tambah",
    update: "Perbarui",
    save: "Simpan",
    saving: "Menyimpan...",
    change: "Ubah",
    choose: "Pilih",
    retry: "Coba lagi",
    rename: "Ganti nama",
    removeFromList: "Hapus dari daftar",
    openInNewTab: "Buka di tab baru",
    duplicate: "Duplikat",
    connect: "Hubungkan",
    disconnect: "Putuskan",
    configure: "Konfigurasi",
    how: "Bagaimana?",
    attach: "Lampirkan",
    ok: "OK",
    goBack: "Kembali",
    closeAll: "Tutup semua",
    back: "Kembali",
    next: "Berikutnya",
    finish: "Selesai"
  },

  markdownTextDocument: {
    openButton: "Buka",
    loading: "Memuat dokumen...",
    loadError: "Tidak dapat memuat konten file.",
    openAriaLabel: (fileName: string) => `Buka dokumen: ${fileName}`
  },

  markdownImage: {
    openImageAria: (fileName: string) => `Buka gambar: ${fileName}`,
    failedToLoad: (fileUrl: string) => `Gagal memuat file: ${fileUrl}`
  },

  models: {
    auto: "Otomatis",
    selectModelTitle: "Pilih model",
    chooseModelRequired: "Pilih model",
    invalidModelFormat: (value: string) => `Format model tidak valid: ${value}`,
    unknownProvider: (providerId: string) => `Penyedia tidak dikenal: ${providerId}`,
    enterModel: "Masukkan model",
    chooseModel: "Pilih model",
    modelNameLabel: "Nama model",
    openRouterPlaceholder: "misalnya: openai/gpt-4o, anthropic/claude-3-5-sonnet",
    openRouterHelp: "Masukkan model apa pun yang tersedia di OpenRouter (misalnya: openai/gpt-4o, anthropic/claude-3-5-sonnet, meta-llama/llama-3.2-90b-vision-instruct)",
    defaultOption: (label: string) => `${label} (default)`
  },

  providers: {
    connected: "Terhubung",
    validationFailed: "Validasi gagal. Periksa API key atau koneksi Anda.",
    apiKeyValidationFailed: "Validasi API key gagal. Kunci mungkin tidak valid atau kedaluwarsa.",
    unknownError: "Terjadi kesalahan tak dikenal",
    connectionFailed: "Koneksi gagal. Periksa jaringan Anda.",
    editTitle: "Edit penyedia",
    deleteTitle: "Hapus penyedia",
    deletePrompt: "Hapus?",
    visitWebsiteTitle: "Kunjungi situs penyedia"
  },

  customProviderSetup: {
    titleAdd: "Tambah penyedia khusus",
    titleEdit: "Edit penyedia khusus",
    labelProviderName: "Nama penyedia",
    labelBaseApiUrl: "Base API URL",
    labelApiKey: "API Key",
    labelModelId: "Model ID",
    labelCustomHeaders: "Header khusus (opsional)",
    placeholderName: "Penyedia khusus saya",
    placeholderBaseApiUrl: "https://api.example.com/v1",
    placeholderApiKey: "sk-...",
    placeholderModelId: "gpt-3.5-turbo",
    placeholderHeaders: "Authorization: Bearer token\nX-Custom-Header: value",
    headersHint: "Satu header per baris dalam format 'key: value'",
    invalidHeadersFormat: "Format header khusus tidak valid. Gunakan 'key: value', satu per baris.",
    saveError: "Gagal menyimpan konfigurasi penyedia",
    addModalTitle: "Tambah penyedia khusus ala OpenAI",
    addButton: "Tambah penyedia khusus"
  },

  customProviderForm: {
    titleAdd: "Tambah penyedia yang kompatibel dengan OpenAI",
    titleEdit: "Edit penyedia yang kompatibel dengan OpenAI",
    labelProviderName: "Nama penyedia*",
    labelApiUrl: "URL API*",
    labelApiKey: "API Key*",
    labelModelId: "Model ID*",
    labelCustomHeaders: "Header khusus (opsional)",
    placeholderName: "Penyedia khusus saya",
    placeholderApiUrl: "https://api.example.com/v1",
    placeholderApiKey: "sk-...",
    placeholderModelId: "gpt-3.5-turbo",
    placeholderHeaders: "Authorization: Bearer token\nContent-Type: application/json",
    hintBaseUrl: "URL dasar untuk pemanggilan API, harus kompatibel dengan OpenAI API",
    hintModelId: "Tentukan model ID yang dibutuhkan penyedia ini",
    hintHeaders: "Masukkan satu header per baris dalam format \"Key: Value\"",
    validationNameRequired: "Nama penyedia wajib diisi",
    validationApiUrlRequired: "URL API wajib diisi",
    validationApiUrlInvalid: "Format URL API tidak valid",
    validationApiKeyRequired: "API key wajib diisi",
    validationModelIdRequired: "Model ID wajib diisi",
    saveFailed: (message: string) => `Gagal menyimpan: ${message}`,
    buttonUpdate: "Perbarui penyedia",
    buttonAddProvider: "Tambah penyedia"
  },

  modelProviderSetup: {
    title: (providerName: string) => `Cara menyiapkan ${providerName}`,
    openai: {
      intro: "Anda perlu memasukkan key untuk menggunakan model OpenAI.",
      steps: {
        signup: "Daftar atau masuk ke OpenAI:",
        addCredits: "Tambahkan kredit ke saldo Anda di sini",
        createKey: "Buat secret key baru di",
        pasteKey: "Tempelkan key di sini dan tunggu validasi."
      }
    },
    anthropic: {
      intro: "Anda perlu memasukkan key untuk menggunakan model Anthropic.",
      steps: {
        signup: "Daftar atau masuk ke Anthropic:",
        createKey: "Buat key baru di",
        pasteKey: "Tempelkan key di sini dan tunggu validasi."
      }
    },
    groq: {
      intro: "Anda perlu memasukkan key untuk menggunakan model Groq.",
      steps: {
        signup: "Daftar atau masuk ke Groq:",
        createKey: "Buat API key di",
        pasteKey: "Tempelkan key di sini dan tunggu validasi."
      }
    },
    deepseek: {
      intro: "Anda perlu memasukkan key untuk menggunakan model DeepSeek.",
      steps: {
        signup: "Daftar atau masuk ke DeepSeek:",
        createKey: "Buat API key di",
        pasteKey: "Tempelkan key di sini dan tunggu validasi."
      }
    },
    google: {
      intro: "Anda perlu memasukkan key untuk menggunakan model Google Gemini.",
      steps: {
        signup: "Daftar atau masuk ke Google AI Studio:",
        createKey: "Buat API key di",
        pasteKey: "Tempelkan key di sini dan tunggu validasi."
      }
    },
    xai: {
      intro: "Anda perlu memasukkan key untuk menggunakan model xAI.",
      steps: {
        signup: "Daftar atau masuk ke xAI:",
        createTeam: "Buat tim dan buka halaman API keys.",
        pasteKey: "Tempelkan key di sini dan tunggu validasi."
      }
    },
    cohere: {
      intro: "Anda perlu memasukkan key untuk menggunakan model Cohere.",
      steps: {
        signup: "Daftar atau masuk ke Cohere:",
        createKey: "Buat API key di",
        pasteKey: "Tempelkan key di sini dan tunggu validasi."
      }
    },
    mistral: {
      intro: "Anda perlu memasukkan key untuk menggunakan model Mistral.",
      steps: {
        signup: "Daftar atau masuk ke Mistral AI:",
        createKey: "Buat API key di",
        pasteKey: "Tempelkan key di sini dan tunggu validasi."
      }
    },
    ollama: {
      intro: "Anda perlu menginstal dan menjalankan Ollama untuk menggunakan modelnya. Anda bisa menjalankannya secara lokal dan Sila akan terhubung.",
      steps: {
        download: "Unduh Ollama dari",
        install: "Instal Ollama dan siapkan model yang ingin digunakan.",
        returnAfterStart: "Kembali ke sini setelah Ollama berjalan."
      }
    },
    openrouter: {
      intro: "Anda perlu memasukkan key untuk menggunakan API terpadu OpenRouter yang memberi akses ke ratusan model AI.",
      steps: {
        signup: "Daftar atau masuk ke OpenRouter:",
        createKey: "Buka pengaturan akun dan bagian API keys untuk membuat key baru.",
        pasteKey: "Tempelkan key di sini dan tunggu validasi."
      }
    },
    noInstructions: "Tidak ada instruksi penyiapan untuk penyedia ini.",
    okButton: "OK"
  },

  sidebar: {
    newConversationTitle: "Percakapan baru",
    workspaceAssetsTitle: "Aset workspace",
    assetsLabel: "Aset"
  },

  renamingPopup: {
    newNameLabel: "Nama baru",
    newNamePlaceholder: "Masukkan nama baru"
  },

  wizards: {
    freshStartTitle: "Selamat datang di Sila",
    freshStartSubtitle: "Buat atau buka workspace",
    freshStartDescription: "Sila bekerja seperti ChatGPT, tetapi di Sila Anda memiliki asisten, percakapan, dan semua data yang dihasilkan. Semakin sering Anda menggunakan AI, data itu semakin bernilai, jadi masuk akal untuk memilikinya sendiri.",
    getStartedButton: "Mulai",
    workspaceTitle: "Buat atau buka workspace",
    workspaceDescription: "Workspace adalah tempat percakapan, file, dan asisten Anda disimpan. Anda bisa memiliki beberapa workspace dan berpindah dengan cepat.",
    spaceSetupNameTitle: "Beri nama workspace",
    spaceSetupNameLabel: "Nama workspace",
    spaceSetupNameDescription: "Beri nama agar mudah dikenali, atau lewati untuk menggunakan nama default. Anda bisa mengubahnya nanti.",
    spaceSetupNamePlaceholder: "Workspace Saya",
    spaceSetupNameHint: "Anda bisa memberi nama sederhana yang menggambarkan tujuan workspace:",
    spaceSetupBrainsTitle: "Siapkan otak untuk workspace",
    spaceSetupBrainsDescription: "Hubungkan setidaknya satu penyedia model AI untuk mulai menggunakan Sila. Kami menyarankan menyiapkan OpenAI, Anthropic, atau Google terlebih dahulu.",
    spaceSetupBrainsStepTitle: "Otak",
    spaceSetupSearchTitle: "Siapkan pencarian untuk workspace (opsional)",
    spaceSetupSearchDescription: "Hubungkan penyedia pencarian agar asisten dapat mencari web. Ini opsional dan bisa dilewati.",
    spaceSetupSearchStepTitle: "Pencarian",
    spaceSetupThemeStepTitle: "Tema",
    spaceSetupLookTitle: "Pilih tampilan workspace",
    colorSchemeLabel: "Skema warna",
    themeLabel: "Tema"
  },

  noTabs: {
    setupBrainsTitle: "Siapkan otak untuk Sila",
    setupBrainsDescription: "Ayo siapkan setidaknya satu penyedia model AI untuk mulai menggunakan Sila. Kami menyarankan OpenAI, Anthropic, atau Google terlebih dahulu karena modelnya paling kuat.",
    readyToStartMessage: "Kami sudah menyiapkan setidaknya satu penyedia, jadi Anda bisa memulai percakapan baru",
    newConversationTitle: "Percakapan baru",
    startConversationButton: "Mulai percakapan",
    chatTitle: "Chat",
    todoNewThread: "@TODO: tambahkan thread baru di sini"
  },

  devPanel: {
    desktopUpdatesTitle: "Pembaruan Desktop",
    currentVersionLabel: "Versi saat ini:",
    desktopUpdatesOnly: "Pembaruan desktop hanya tersedia di aplikasi desktop.",
    exitDevMode: "Keluar dari Mode Dev",
    devModeStatus: (version: string) => `🚧 Sila ${version} dalam Mode Dev`,
    openSpaceInspector: "Buka Space Inspector",
    closeSpaceInspector: "Tutup Space Inspector",
    versionLabel: "Versi",
    shellLabel: "Shell",
    clientLabel: "Client",
    updatesLabel: "Pembaruan",
    checkingUpdates: "Memeriksa...",
    checkForUpdates: "Periksa pembaruan"
  },

  fileViewer: {
    loading: "Memuat...",
    noContent: "Tidak ada konten untuk ditampilkan."
  },

  chat: {
    assistantConfigIdLabel: "configId asisten:",
    unknown: "tidak dikenal",
    unknownError: "Kesalahan tidak dikenal",
    aiLabel: "AI",
    processing: "Memproses",
    messageInfoAssistant: "Asisten:",
    messageInfoModel: "Model:",
    messageInfoCreated: "Dibuat:",
    messageInfoUpdated: "Diperbarui:",
    messageInfoAria: "Info pesan",
    thinking: "Sedang berpikir",
    acting: "Bertindak",
    thoughtActed: "Berpikir, bertindak",
    acted: "Bertindak",
    thought: "Berpikir",
    errorLoadingAppTree: "Gagal memuat app tree",
    viewFilesAria: "Lihat file chat",
    scrollToBottomAria: "Gulir ke bawah",
    chatFilesTitle: "File chat"
  },

  chatControls: {
    copyMessage: "Salin pesan",
    editMessage: "Edit pesan",
    rerunInNewBranch: "Jalankan ulang di cabang baru"
  },

  fileMention: {
    noFilesFound: "File tidak ditemukan",
    loading: "Memuat...",
    previewNotFound: "File tidak ditemukan",
    previewResolveFailed: "Gagal memuat file",
    previewUnknownError: "Kesalahan tidak dikenal"
  },

  filesApp: {
    filesRootNotFound: "Root file tidak ditemukan.",
    uploadFiles: "Unggah file",
    uploading: "Mengunggah...",
    newFolder: "Folder baru",
    emptyFolderPrefix: "Anda bisa",
    emptyFolderUpload: "mengunggah",
    emptyFolderOr: "atau",
    emptyFolderMove: "memindahkan",
    emptyFolderSuffix: "file ke folder ini.",
    errorLoadingFilesRoot: "Gagal memuat root file",
    filesAndFoldersLabel: "File dan folder",
    workspaceLabel: "Workspace",
    unnamedLabel: "Tanpa nama",
    untitledLabel: "Tanpa judul",
    moreItems: (count: number) => `+ ${count} lainnya…`
  },

  attachments: {
    addAttachmentsAria: "Tambah lampiran (atau tempel file)",
    uploadPhotosFiles: "Unggah foto & file",
    browseWorkspaceFiles: "Jelajahi file workspace",
    setupProviderMessage: "Siapkan penyedia model untuk chat dengan AI.",
    setupBrainsButton: "Siapkan otak",
    processingImage: "Memproses gambar...",
    processingTextFile: "Memproses file teks...",
    linesLabel: "baris",
    wordsLabel: "kata",
    removeAttachmentAria: "Hapus lampiran"
  },

  files: {
    loadingFile: "Memuat...",
    noFileData: "Tidak ada data file",
    loadingPdf: "Memuat PDF...",
    pdfLoadFailed: "Gagal memuat PDF",
    invalidReference: "Referensi file tidak valid",
    failedToLoad: "Gagal memuat file",
    failedToLoadWithMessage: (message: string) => `Gagal memuat file: ${message}`,
    unknownError: "Kesalahan tidak dikenal"
  },

  spaceInspector: {
    spaceLabel: "Space",
    openCurrentAppTree: "Buka App Tree saat ini",
    appTreeLabel: "App Tree",
    toggleExpandAria: "Alihkan perluas",
    childrenLabel: "anak:",
    addVertexAria: "Tambah vertex baru",
    deleteVertexAria: "Hapus vertex",
    addPropertyLabel: "Tambah properti",
    propertyKeyPlaceholder: "Kunci properti",
    valuePlaceholder: "Nilai",
    typeString: "String",
    typeNumber: "Angka",
    typeBoolean: "Boolean",
    createProperty: "Buat",
    createdAtLabel: "dibuat",
    appTreePropertyLabel: "app tree",
    windowAriaLabel: "Jendela Space Inspector",
    windowTitle: "Space Inspector",
    dragWindowAria: "Seret jendela",
    resizeWindowAria: "Ubah ukuran jendela"
  },

  spacesList: {
    newSpaceLabel: "Space baru",
    localSpaceLabel: "Space lokal",
    noSpacesFound: "Tidak ada space"
  },

  auth: {
    serversOfflineTitle: "Server sedang offline",
    serversOfflineMessage: "Gunakan mode lokal jika ingin mencoba",
    continueWithGoogle: "Lanjutkan dengan Google",
    continueWithGithub: "Lanjutkan dengan Github",
    continueWithGithubComingSoon: "Lanjutkan dengan Github (Segera hadir)",
    continueWithX: "Lanjutkan dengan X",
    continueWithXComingSoon: "Lanjutkan dengan X (Segera hadir)",
    signInTitle: "Masuk",
    signInAction: "Masuk",
    profileTitle: "Profil",
    signOut: "Keluar",
    userAvatarAlt: "Avatar pengguna",
    userFallbackName: "Pengguna",
    googleAlt: "Google",
    githubAlt: "Github",
    xAlt: "X"
  },

  updates: {
    updatesTitle: "Pembaruan",
    checkForUpdates: "Periksa pembaruan",
    checkingForUpdates: "Memeriksa...",
    checkingLabel: "Memeriksa pembaruan…",
    downloadKindClientBuild: "build klien",
    downloadKindElectron: "electron",
    downloadKindUpdate: "pembaruan",
    downloadingLabel: (kind: string, version: string | null) => {
      const suffix = version ? ` (${version})` : "";
      return `Mengunduh ${kind}${suffix}…`;
    },
    downloadedLabel: "Pembaruan sudah diunduh.",
    failedLabel: "Pembaruan gagal."
  },

  workspaceCreate: {
    title: "Beri nama workspace",
    nameLabel: "Nama workspace",
    namePlaceholder: "Workspace Saya",
    nameEmptyError: "Nama workspace tidak boleh kosong.",
    nameUnsupportedError: "Nama workspace mengandung karakter yang tidak didukung.",
    nameAlreadyExistsError: "Folder dengan nama ini sudah ada di lokasi yang dipilih.",
    nameAlreadyExistsInline: "Workspace dengan nama ini sudah ada di folder yang dipilih.",
    nameDescription: "Anda bisa memberi nama sederhana yang menggambarkan tujuan workspace:",
    newWorkspaceLocationLabel: "Workspace baru akan dibuat di:",
    selectLocationPlaceholder: "Pilih lokasi",
    changeLocation: "Ubah lokasi",
    creating: "Membuat...",
    createWorkspace: "Buat workspace",
    chooseLocationTitle: "Pilih lokasi untuk membuat workspace",
    folderAlreadyUsedTitle: "Folder sudah digunakan",
    folderAlreadyUsedMessage: "Pilih folder di luar workspace yang ada.",
    failedAccessFolderTitle: "Gagal mengakses folder",
    failedAccessFolderMessage: "Kami tidak dapat mengakses folder yang dipilih.",
    failedAccessFolderUnknown: "Terjadi kesalahan tak dikenal saat memilih folder.",
    chooseFolderError: "Pilih folder untuk menyimpan workspace.",
    cannotUseFolderTitle: "Tidak bisa menggunakan folder ini",
    cannotUseFolderMessage: "Pilih lokasi lain untuk workspace Anda.",
    failedCreateWorkspaceTitle: "Gagal membuat workspace",
    failedCreateWorkspaceMessage: "Kami tidak dapat membuat workspace.",
    failedCreateWorkspaceFallback: "Gagal membuat workspace.",
    defaultFolderName: "workspace baru",
    presetNames: ["Pribadi", "Kerja", "Studi", "Sekolah"]
  },

  filePicker: {
    workspaceFilesUnavailable: "File workspace tidak tersedia.",
    workspaceFilesTitle: "File workspace"
  },

  appTreeMenu: {
    openInNewTab: "Buka di tab baru"
  },

  spaceEntry: {
    initializationError: "Kesalahan inisialisasi"
  },

  tabs: {
    closeTab: "Tutup tab",
    startNewConversation: "Mulai percakapan baru",
    newConversationShortcut: "Percakapan baru (Cmd/Ctrl + N)"
  }
};
