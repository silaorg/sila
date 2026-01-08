import type { Texts } from "../texts";

export const turkishTexts: Partial<Texts> = {
  basics: {
    name: "Ad",
    button: "Buton",
    description: "Açıklama",
    instructions: "Talimatlar",
    optional: "İsteğe bağlı",
    loading: "Yükleniyor...",
    thinking: "Düşünüyor...",
    model: "Model",
    apps: "Asistanlar",
  },

  messageForm: {
    placeholder: "İstediğini sor",
    attachFile: "Dosya ekle",
    send: "Mesaj gönder",
    stop: "Üretmeyi durdur"
  },

  appPage: {
    title: "Asistanlar",
    buttonNewConfig: "Yeni Asistan",
    chatsTitle: "Asistanların",
    description: "Buradan sohbet asistanlarını oluşturup düzenleyebilirsin. Asistan düğmeleri kenar çubuğunun sağ üstünde görünür.",
    contactMessage: "Diğer uygulama türleri ileride gelecek. Fikir veya önerin varsa <a class=\"anchor\" href=\"mailto:d@dkury.com\">d@dkury.com</a> adresine yaz."
  },

  appConfigPage: {
    newConfigTitle: "Yeni Asistan",
    editConfigTitle: "Asistanı Düzenle",
    defaultConfigTitle: "Varsayılan Asistan",
    editAssistantTitle: "Asistanı Düzenle",
    editAssistantButton: "Asistanı Düzenle",
    startChatTitle: "Sohbet Başlat",
    startChatDescription: "Bu asistanla sohbet başlat",
    dragToReorder: "Sürükleyerek sırala (henüz yok)",
    newConfigButton: "Yeni konu düğmesi (isteğe bağlı)",
    buttonCreate: "Oluştur",
    buttonSave: "Değişiklikleri kaydet",
    namePlaceholder: "Asistanına isim ver",
    descriptionPlaceholder: "Bu asistanın ne yaptığını kısaca açıkla",
    instructionsPlaceholder:
      "“Sen ...” diye başlayın. AI'ya yeni bir çalışan için yazıyormuş gibi talimat verin",
    buttonPlaceholder: "Düğme için kısa eylem metni",
    gotoNewConfig: "Yeni bir asistan oluşturmak için buraya git",
    errorValidationRequired: "Bu alan zorunlu",
    errorAppConfigLoadFailure: "Asistan yapılandırması yüklenemedi",
    tableCell: {
      deleteButton: "Sil",
      visibilityLabel: "Asistanı kenar çubuğunda göster/gizle",
      deleteLabel: "Asistan yapılandırmasını sil"
    },
    defaultConfigMessage: "Bu varsayılan sohbet asistanının yapılandırmasıdır. Kullanılan modeli değiştirebilir veya yeni bir asistan oluşturabilirsiniz.",
    defaultConfigGotoNew: "Yeni asistan",
    description: "Varsayılan sohbet uygulamasına göre kendi sistem yönergelerinizi oluşturabilirsiniz. Sila’nın gelecekteki sürümlerinde araçlar ve harici API’lerle başka uygulama türleri mümkün olacak.",
  },

  defaultAppConfig: {
    name: "Sohbet",
    button: "Yeni sorgu",
    description: "Temel bir sohbet asistanı",
    instructions:
      "Sen Sila, bir AI asistansın. Tüm yanıtlarda doğrudan ol. Basit bir dil kullan. Nezaket kalıplarından, dolgu sözlerden ve resmiyetten kaçın.",
  },

  appConfigDropdown: {
    placeholder: "Bir asistan seç...",
    newAssistant: "Yeni Asistan",
    editConfigTitle: "Yapılandırmayı Düzenle",
    editAssistantLabel: (assistantName: string) => `"${assistantName}" asistanını düzenle`
  },

  modelSelection: {
    manageProviders: "Model sağlayıcılarını yönet",
    done: "Bitti",
    backToSelection: "Model seçimine dön"
  },

  settingsPage: {
    title: "Ayarlar",
    appearance: {
      title: "Görünüm",
      theme: "Tema",
      themeDescription: "Çalışma alanınız için bir renk teması seçin.",
      language: "Dil",
      colorScheme: "Renk şeması",
      system: "Sistem",
      dark: "Koyu",
      light: "Açık",
      switchToLightMode: "Açık moda geç",
      switchToDarkMode: "Koyu moda geç"
    },
    providers: {
      title: "Model Sağlayıcıları",
      description: "Asistanlarını çalıştırmak için model sağlayıcıları bağla. Bunlar asistanların “beyni”. Önce OpenAI, Anthropic veya Google’ı kurmanı öneririz."
    },
    sidebar: {
      workspaceTitle: "Çalışma alanı",
      workspacePreferencesTitle: "Çalışma alanı tercihleri",
      workspacePreferencesLabel: "Tercihler",
      appTitle: "Uygulama"
    },
    workspacePreferences: {
      description: "Çalışma alanınızı yapay zeka için tanımlayın ve arayüz ile yapay zeka dilini seçin.",
      descriptionLabel: "Çalışma alanı açıklaması",
      descriptionPlaceholder: "Bu çalışma alanının amacını veya asistan tercihlerini düz metinle açıklayın.",
      storedPathLabel: "Bu çalışma alanı şurada saklanır:",
      revealButton: "Göster",
      noWorkspaceLoaded: "Çalışma alanı yüklenmedi.",
      notStoredOnDiskError: "Bu çalışma alanı diskte saklanmıyor.",
      revealUnsupportedError: "Gösterme bu sürümde desteklenmiyor.",
      revealFailedError: "Çalışma alanı yolu gösterilemedi."
    },
    workspacePrivacySync: {
      storageTitle: "Depolama",
      workspaceLocationLabel: "Çalışma alanı konumu:",
      noWorkspaceLoaded: "Çalışma alanı yüklenmedi.",
      syncPlaceholder: "Senkronizasyon ayarları yakında geliyor."
    },
    personalization: {
      title: "Kullanıcı profili",
      description: "Profil bilgileri ve kişiselleştirme tercihleri yakında geliyor.",
      openProfile: "Profili aç",
      signInPlaceholder: "Kimlik doğrulama etkinleştirildiğinde oturum açma seçenekleri burada görünecek."
    },
    spaces: {
      title: "Çalışma Alanları",
      spaceCount: (count: number) => `${count === 1 ? "1 çalışma alanın var" : `${count} çalışma alanın var`}`,
      manageButton: "Yönet"
    },
    developers: {
      title: "Geliştiriciler için",
      toggleDevMode: "Geliştirici modunu aç/kapat"
    }
  },

  spacesPage: {
    title: "Çalışma Alanların",
    description: "Çalışma alanı, AI uygulamalarının ve diğer verilerinin saklandığı yerdir. Birden fazla alanın olabilir ve aralarında geçiş yapabilirsin. Örneğin biri iş, diğeri kişisel olabilir.",
    opener: {
      createTitle: "Yeni çalışma alanı oluştur",
      createDescription: "Yeni çalışma alanın için bir klasör seç. Yerel olabilir ya da iCloud, Dropbox, Google Drive vb. ile senkronize olabilir.",
      createButton: "Oluştur",
      openTitle: "Çalışma alanı aç",
      openDescription: "Çalışma alanını içeren klasörü aç.",
      openButton: "Aç",
      errorCreate: "Çalışma alanı oluşturulamadı",
      errorOpen: "Çalışma alanı açılamadı",
      errorOpenTitle: "Çalışma Alanı Açılamadı",
      errorOpenUnknown: "Çalışma alanı açılırken bilinmeyen bir hata oluştu.",
      dialogCreateTitle: "Yeni çalışma alanı için klasör seç",
      dialogOpenTitle: "Çalışma alanı içeren klasör seç"
    },
    openerPageTitle: "Çalışma alanı oluştur veya aç",
    openerPageDescription: "Yeni bir çalışma alanı oluşturabilir veya var olanı açabilirsin.",
    addWorkspaceButton: "Çalışma alanı ekle",
    defaultWorkspaceName: "Çalışma alanı",
    manageWorkspacesButton: "Çalışma alanlarını yönet"
  },

  actions: {
    open: "Aç",
    edit: "Düzenle",
    delete: "Sil",
    done: "Bitti",
    cancel: "İptal",
    confirm: "Onayla",
    close: "Kapat",
    copy: "Kopyala",
    add: "Ekle",
    update: "Güncelle",
    save: "Kaydet",
    saving: "Kaydediliyor...",
    change: "Değiştir",
    choose: "Seç",
    retry: "Tekrar dene",
    rename: "Yeniden adlandır",
    removeFromList: "Listeden kaldır",
    openInNewTab: "Yeni sekmede aç",
    duplicate: "Kopyala",
    connect: "Bağlan",
    disconnect: "Bağlantıyı kes",
    configure: "Yapılandır",
    how: "Nasıl?",
    attach: "Ekle",
    ok: "Tamam",
    goBack: "Geri dön",
    closeAll: "Tümünü kapat",
    back: "Geri",
    next: "İleri",
    finish: "Bitir"
  },

  markdownTextDocument: {
    openButton: "Aç",
    loading: "Belge yükleniyor...",
    loadError: "Dosya içeriği yüklenemedi.",
    openAriaLabel: (fileName: string) => `Belgeyi aç: ${fileName}`
  },

  markdownImage: {
    openImageAria: (fileName: string) => `Görüntüyü aç: ${fileName}`,
    failedToLoad: (fileUrl: string) => `Dosya yüklenemedi: ${fileUrl}`
  },

  models: {
    auto: "Otomatik",
    selectModelTitle: "Model Seç",
    chooseModelRequired: "Model seçin",
    invalidModelFormat: (value: string) => `Geçersiz model formatı: ${value}`,
    unknownProvider: (providerId: string) => `Bilinmeyen sağlayıcı: ${providerId}`,
    enterModel: "Model gir",
    chooseModel: "Model seç",
    modelNameLabel: "Model Adı",
    openRouterPlaceholder: "ör. openai/gpt-4o, anthropic/claude-3-5-sonnet",
    openRouterHelp: "OpenRouter’daki herhangi bir modeli girin (ör. openai/gpt-4o, anthropic/claude-3-5-sonnet, meta-llama/llama-3.2-90b-vision-instruct)",
    defaultOption: (label: string) => `${label} (varsayılan)`
  },

  providers: {
    connected: "Bağlı",
    validationFailed: "Doğrulama başarısız. API anahtarını veya bağlantıyı kontrol edin.",
    apiKeyValidationFailed: "API anahtarı doğrulanamadı. Anahtar geçersiz veya süresi dolmuş olabilir.",
    unknownError: "Bilinmeyen hata",
    connectionFailed: "Bağlantı başarısız. Lütfen ağınızı kontrol edin.",
    editTitle: "Sağlayıcıyı düzenle",
    deleteTitle: "Sağlayıcıyı sil",
    deletePrompt: "Silinsin mi?",
    visitWebsiteTitle: "Sağlayıcının sitesini ziyaret et"
  },

  customProviderSetup: {
    titleAdd: "Özel Sağlayıcı Ekle",
    titleEdit: "Özel Sağlayıcıyı Düzenle",
    labelProviderName: "Sağlayıcı Adı",
    labelBaseApiUrl: "Temel API URL",
    labelApiKey: "API Anahtarı",
    labelModelId: "Model ID",
    labelCustomHeaders: "Özel Başlıklar (isteğe bağlı)",
    placeholderName: "Benim Özel Sağlayıcım",
    placeholderBaseApiUrl: "https://api.example.com/v1",
    placeholderApiKey: "sk-...",
    placeholderModelId: "gpt-3.5-turbo",
    placeholderHeaders: "Authorization: Bearer token\nX-Custom-Header: value",
    headersHint: "Her satıra bir başlık olacak şekilde 'key: value' formatını kullanın",
    invalidHeadersFormat: "Özel başlık formatı geçersiz. 'key: value' formatını kullanın, her satıra bir tane.",
    saveError: "Sağlayıcı yapılandırması kaydedilemedi",
    addModalTitle: "Özel OpenAI benzeri Sağlayıcı Ekle",
    addButton: "Özel Sağlayıcı Ekle"
  },

  customProviderForm: {
    titleAdd: "Özel OpenAI uyumlu sağlayıcı ekle",
    titleEdit: "Özel OpenAI uyumlu sağlayıcıyı düzenle",
    labelProviderName: "Sağlayıcı Adı*",
    labelApiUrl: "API URL*",
    labelApiKey: "API Anahtarı*",
    labelModelId: "Model ID*",
    labelCustomHeaders: "Özel Başlıklar (isteğe bağlı)",
    placeholderName: "Benim Özel Sağlayıcım",
    placeholderApiUrl: "https://api.example.com/v1",
    placeholderApiKey: "sk-...",
    placeholderModelId: "gpt-3.5-turbo",
    placeholderHeaders: "Authorization: Bearer token\nContent-Type: application/json",
    hintBaseUrl: "API çağrıları için temel URL, OpenAI API ile uyumlu olmalı",
    hintModelId: "Bu sağlayıcının istediği model ID’sini belirtin",
    hintHeaders: "Her satıra bir başlık olacak şekilde “Key: Value” formatı",
    validationNameRequired: "Sağlayıcı adı zorunlu",
    validationApiUrlRequired: "API URL zorunlu",
    validationApiUrlInvalid: "Geçersiz API URL formatı",
    validationApiKeyRequired: "API anahtarı zorunlu",
    validationModelIdRequired: "Model ID zorunlu",
    saveFailed: (message: string) => `Kaydedilemedi: ${message}`,
    buttonUpdate: "Sağlayıcıyı güncelle",
    buttonAddProvider: "Sağlayıcı ekle"
  },

  modelProviderSetup: {
    title: (providerName: string) => `${providerName} nasıl kurulur`,
    openai: {
      intro: "OpenAI modellerini kullanmak için bir anahtar girmelisiniz.",
      steps: {
        signup: "OpenAI’ye kayıt olun veya giriş yapın:",
        addCredits: "Bakiyenize buradan kredi ekleyin",
        createKey: "Buradan yeni bir gizli anahtar oluşturun",
        pasteKey: "Anahtarı buraya yapıştırın ve doğrulanmasını bekleyin."
      }
    },
    anthropic: {
      intro: "Anthropic modellerini kullanmak için bir anahtar girmelisiniz.",
      steps: {
        signup: "Anthropic’e kayıt olun veya giriş yapın:",
        createKey: "Buradan yeni bir anahtar oluşturun",
        pasteKey: "Anahtarı buraya yapıştırın ve doğrulanmasını bekleyin."
      }
    },
    groq: {
      intro: "Groq modellerini kullanmak için bir anahtar girmelisiniz.",
      steps: {
        signup: "Groq’a kayıt olun veya giriş yapın:",
        createKey: "Buradan bir API anahtarı oluşturun",
        pasteKey: "Anahtarı buraya yapıştırın ve doğrulanmasını bekleyin."
      }
    },
    deepseek: {
      intro: "DeepSeek modellerini kullanmak için bir anahtar girmelisiniz.",
      steps: {
        signup: "DeepSeek’e kayıt olun veya giriş yapın:",
        createKey: "Buradan bir API anahtarı oluşturun",
        pasteKey: "Anahtarı buraya yapıştırın ve doğrulanmasını bekleyin."
      }
    },
    google: {
      intro: "Google Gemini modellerini kullanmak için bir anahtar girmelisiniz.",
      steps: {
        signup: "Google AI Studio’ya kayıt olun veya giriş yapın:",
        createKey: "Buradan bir API anahtarı oluşturun",
        pasteKey: "Anahtarı buraya yapıştırın ve doğrulanmasını bekleyin."
      }
    },
    xai: {
      intro: "xAI modellerini kullanmak için bir anahtar girmelisiniz.",
      steps: {
        signup: "xAI’ye kayıt olun veya giriş yapın:",
        createTeam: "Bir ekip oluşturup API keys sayfasına gidin.",
        pasteKey: "Anahtarı buraya yapıştırın ve doğrulanmasını bekleyin."
      }
    },
    cohere: {
      intro: "Cohere modellerini kullanmak için bir anahtar girmelisiniz.",
      steps: {
        signup: "Cohere’e kayıt olun veya giriş yapın:",
        createKey: "Buradan bir API anahtarı oluşturun",
        pasteKey: "Anahtarı buraya yapıştırın ve doğrulanmasını bekleyin."
      }
    },
    mistral: {
      intro: "Mistral modellerini kullanmak için bir anahtar girmelisiniz.",
      steps: {
        signup: "Mistral AI’ye kayıt olun veya giriş yapın:",
        createKey: "Buradan bir API anahtarı oluşturun",
        pasteKey: "Anahtarı buraya yapıştırın ve doğrulanmasını bekleyin."
      }
    },
    ollama: {
      intro: "Ollama modellerini kullanmak için Ollama’yı kurup çalıştırmanız gerekir. Yerelde çalıştırın, Sila bağlanacaktır.",
      steps: {
        download: "Ollama’yı buradan indirin",
        install: "Ollama’yı kurun ve kullanmak istediğiniz modeli ayarlayın.",
        returnAfterStart: "Başlattıktan sonra buraya dönün."
      }
    },
    openrouter: {
      intro: "OpenRouter’ın birleşik API’sine erişmek için bir anahtar girmelisiniz.",
      steps: {
        signup: "OpenRouter’a kayıt olun veya giriş yapın:",
        createKey: "Hesap ayarlarında API keys bölümüne gidip yeni bir API anahtarı oluşturun.",
        pasteKey: "Anahtarı buraya yapıştırın ve doğrulanmasını bekleyin."
      }
    },
    noInstructions: "Bu sağlayıcı için kurulum talimatı yok.",
    okButton: "Tamam"
  },

  sidebar: {
    newConversationTitle: "Yeni konuşma",
    workspaceAssetsTitle: "Çalışma Alanı Varlıkları",
    assetsLabel: "Varlıklar"
  },

  renamingPopup: {
    newNameLabel: "Yeni ad",
    newNamePlaceholder: "Yeni adı gir"
  },

  wizards: {
    freshStartTitle: "Sila’ya Hoş Geldin",
    freshStartSubtitle: "Çalışma alanı oluştur veya aç",
    freshStartDescription: "Sila, ChatGPT gibi çalışır ama Sila’da asistanların, sohbetlerin ve üretilen tüm veriler senindir. AI’ı daha çok kullandıkça seni daha iyi tanır ve verilerin daha değerli olur — bu yüzden kontrol sende olmalı.",
    getStartedButton: "Başlayın",
    workspaceTitle: "Çalışma alanı oluştur veya aç",
    workspaceDescription: "Çalışma alanı konuşmalarını, dosyalarını ve asistanlarını saklar. Birden fazla alanın olabilir ve hızlıca geçiş yapabilirsin.",
    spaceSetupNameTitle: "Çalışma alanına isim ver",
    spaceSetupNameLabel: "Çalışma alanı adı",
    spaceSetupNameDescription: "Tanımak için bir isim ver ya da atlayıp varsayılan adla devam et. Sonradan değiştirebilirsin.",
    spaceSetupNamePlaceholder: "Benim Çalışma Alanım",
    spaceSetupNameHint: "Amacı anlatan basit bir ad verebilirsin:",
    spaceSetupBrainsTitle: "Çalışma alanın için beyinleri kur",
    spaceSetupBrainsDescription: "Sila’yı kullanmaya başlamak için en az bir model sağlayıcısı bağla. Önce OpenAI, Anthropic veya Google’ı kurmanı öneririz.",
    spaceSetupBrainsStepTitle: "Beyinler",
    spaceSetupSearchTitle: "Çalışma alanı için aramayı kur (isteğe bağlı)",
    spaceSetupSearchDescription: "Asistanlarının web’de arama yapabilmesi için bir arama sağlayıcısı bağla. Bu isteğe bağlıdır; şimdilik atlayabilirsin.",
    spaceSetupSearchStepTitle: "Arama",
    spaceSetupThemeStepTitle: "Tema",
    spaceSetupLookTitle: "Çalışma alanının görünümünü seç",
    colorSchemeLabel: "Renk şeması",
    themeLabel: "Tema"
  },

  noTabs: {
    setupBrainsTitle: "Sila için beyinleri kur",
    setupBrainsDescription: "Sila’yı kullanmaya başlamak için en az bir model sağlayıcısı kur. Önce OpenAI, Anthropic veya Google’ı öneririz — en güçlü modeller onlarda.",
    readyToStartMessage: "En az bir sağlayıcı kurulu, yeni bir konuşma başlatabiliriz",
    newConversationTitle: "Yeni konuşma",
    startConversationButton: "Konuşmayı başlat",
    chatTitle: "Sohbet",
    todoNewThread: "@TODO: buraya yeni konu ekle"
  },

  devPanel: {
    desktopUpdatesTitle: "Masaüstü Güncellemeleri",
    currentVersionLabel: "Mevcut sürüm:",
    desktopUpdatesOnly: "Masaüstü güncellemeleri yalnızca masaüstü uygulamasında kullanılabilir.",
    exitDevMode: "Geliştirici Modundan çık",
    devModeStatus: (version: string) => `🚧 Sila ${version} Geliştirici Modunda`,
    openSpaceInspector: "Alan Denetleyiciyi aç",
    closeSpaceInspector: "Alan Denetleyiciyi kapat",
    versionLabel: "Sürüm",
    shellLabel: "Shell",
    clientLabel: "İstemci",
    updatesLabel: "Güncellemeler",
    checkingUpdates: "Kontrol ediliyor...",
    checkForUpdates: "Güncellemeleri kontrol et"
  },

  fileViewer: {
    loading: "Yükleniyor...",
    noContent: "Gösterilecek içerik yok."
  },

  chat: {
    assistantConfigIdLabel: "Asistan configId:",
    unknown: "bilinmiyor",
    unknownError: "Bilinmeyen hata",
    aiLabel: "AI",
    processing: "İşleniyor",
    messageInfoAssistant: "Asistan:",
    messageInfoModel: "Model:",
    messageInfoCreated: "Oluşturulma:",
    messageInfoUpdated: "Güncellendi:",
    messageInfoAria: "Mesaj bilgisi",
    thinking: "Düşünüyor",
    acting: "Hareket ediyor",
    thoughtActed: "Düşündü ve yaptı",
    acted: "Yaptı",
    thought: "Düşündü",
    errorLoadingAppTree: "Uygulama ağacı yüklenirken hata",
    viewFilesAria: "Sohbet dosyalarını görüntüle",
    scrollToBottomAria: "En alta kaydır",
    chatFilesTitle: "Sohbet dosyaları"
  },

  chatControls: {
    copyMessage: "Mesajı kopyala",
    editMessage: "Mesajı düzenle",
    rerunInNewBranch: "Yeni dalda yeniden çalıştır"
  },

  fileMention: {
    noFilesFound: "Dosya bulunamadı",
    loading: "Yükleniyor...",
    previewNotFound: "Dosya bulunamadı",
    previewResolveFailed: "Dosya çözümlenemedi",
    previewUnknownError: "Bilinmeyen hata"
  },

  filesApp: {
    filesRootNotFound: "Dosya kökü bulunamadı.",
    uploadFiles: "Dosya yükle",
    uploading: "Yükleniyor...",
    newFolder: "Yeni klasör",
    emptyFolderPrefix: "Şunları yapabilirsin:",
    emptyFolderUpload: "yükle",
    emptyFolderOr: "veya",
    emptyFolderMove: "taşı",
    emptyFolderSuffix: "dosyalarını bu klasöre.",
    errorLoadingFilesRoot: "Dosya kökü yüklenemedi",
    filesAndFoldersLabel: "Dosyalar ve klasörler",
    workspaceLabel: "Çalışma alanı",
    unnamedLabel: "Adsız",
    untitledLabel: "Başlıksız",
    moreItems: (count: number) => `+ ${count} daha…`
  },

  attachments: {
    addAttachmentsAria: "Ekleri ekle (veya dosya yapıştır)",
    uploadPhotosFiles: "Fotoğraf ve dosya yükle",
    browseWorkspaceFiles: "Çalışma alanı dosyalarına göz at",
    setupProviderMessage: "AI ile sohbet etmek için bir model sağlayıcısı kurun.",
    setupBrainsButton: "Beyinleri kur",
    processingImage: "Görüntü işleniyor...",
    processingTextFile: "Metin dosyası işleniyor...",
    linesLabel: "satır",
    wordsLabel: "kelime",
    removeAttachmentAria: "Eki kaldır"
  },

  files: {
    loadingFile: "Yükleniyor...",
    noFileData: "Dosya verisi yok",
    loadingPdf: "PDF yükleniyor...",
    pdfLoadFailed: "PDF yüklenemedi",
    invalidReference: "Geçersiz dosya referansı",
    failedToLoad: "Dosya yüklenemedi",
    failedToLoadWithMessage: (message: string) => `Dosya yüklenemedi: ${message}`,
    unknownError: "Bilinmeyen hata"
  },

  spaceInspector: {
    spaceLabel: "Alan",
    openCurrentAppTree: "Mevcut uygulama ağacını aç",
    appTreeLabel: "Uygulama ağacı",
    toggleExpandAria: "Genişlet/daralt",
    childrenLabel: "çocuklar:",
    addVertexAria: "Yeni düğüm ekle",
    deleteVertexAria: "Düğümü sil",
    addPropertyLabel: "Özellik ekle",
    propertyKeyPlaceholder: "Özellik anahtarı",
    valuePlaceholder: "Değer",
    typeString: "Metin",
    typeNumber: "Sayı",
    typeBoolean: "Boolean",
    createProperty: "Oluştur",
    createdAtLabel: "oluşturulma",
    appTreePropertyLabel: "uygulama ağacı",
    windowAriaLabel: "Alan Denetleyici Penceresi",
    windowTitle: "Alan Denetleyici",
    dragWindowAria: "Pencereyi sürükle",
    resizeWindowAria: "Pencereyi yeniden boyutlandır"
  },

  spacesList: {
    newSpaceLabel: "Yeni Alan",
    localSpaceLabel: "Yerel alan",
    noSpacesFound: "Alan bulunamadı"
  },

  auth: {
    serversOfflineTitle: "Sunucular şu anda çevrimdışı",
    serversOfflineMessage: "Test etmek için yerel modda devam edebilirsin",
    continueWithGoogle: "Google ile devam et",
    continueWithGithub: "GitHub ile devam et",
    continueWithGithubComingSoon: "GitHub ile devam et (yakında)",
    continueWithX: "X ile devam et",
    continueWithXComingSoon: "X ile devam et (yakında)",
    signInTitle: "Giriş Yap",
    signInAction: "Giriş Yap",
    profileTitle: "Profil",
    signOut: "Çıkış Yap",
    userAvatarAlt: "Kullanıcı avatarı",
    userFallbackName: "Kullanıcı",
    googleAlt: "Google",
    githubAlt: "GitHub",
    xAlt: "X"
  },

  updates: {
    updatesTitle: "Güncellemeler",
    checkForUpdates: "Güncellemeleri kontrol et",
    checkingForUpdates: "Kontrol ediliyor...",
    checkingLabel: "Güncellemeler kontrol ediliyor…",
    downloadKindClientBuild: "istemci derlemesi",
    downloadKindElectron: "electron",
    downloadKindUpdate: "güncelleme",
    downloadingLabel: (kind: string, version: string | null) => {
      const suffix = version ? ` (${version})` : "";
      return `İndiriliyor: ${kind}${suffix}…`;
    },
    downloadedLabel: "Güncelleme indirildi.",
    failedLabel: "Güncelleme başarısız."
  },

  workspaceCreate: {
    title: "Çalışma alanına isim ver",
    nameLabel: "Çalışma alanı adı",
    namePlaceholder: "Benim Çalışma Alanım",
    nameEmptyError: "Çalışma alanı adı boş olamaz.",
    nameUnsupportedError: "Çalışma alanı adında desteklenmeyen karakterler var.",
    nameAlreadyExistsError: "Seçilen konumda bu adla bir klasör zaten var.",
    nameAlreadyExistsInline: "Seçilen klasörde bu adla bir çalışma alanı zaten var.",
    nameDescription: "Amacı anlatan basit bir ad verebilirsiniz:",
    newWorkspaceLocationLabel: "Yeni çalışma alanı şurada oluşturulacak:",
    selectLocationPlaceholder: "Konum seç",
    changeLocation: "Konumu değiştir",
    creating: "Oluşturuluyor...",
    createWorkspace: "Çalışma alanı oluştur",
    chooseLocationTitle: "Çalışma alanının oluşturulacağı yeri seç",
    folderAlreadyUsedTitle: "Klasör zaten kullanılıyor",
    folderAlreadyUsedMessage: "Mevcut çalışma alanlarının dışında bir klasör seçin.",
    failedAccessFolderTitle: "Klasöre erişilemedi",
    failedAccessFolderMessage: "Seçilen klasöre erişemedik.",
    failedAccessFolderUnknown: "Klasör seçilirken bilinmeyen bir hata oluştu.",
    chooseFolderError: "Çalışma alanı için bir klasör seçin.",
    cannotUseFolderTitle: "Bu klasör kullanılamaz",
    cannotUseFolderMessage: "Çalışma alanınız için başka bir konum seçin.",
    failedCreateWorkspaceTitle: "Çalışma alanı oluşturulamadı",
    failedCreateWorkspaceMessage: "Çalışma alanını oluşturamadık.",
    failedCreateWorkspaceFallback: "Çalışma alanı oluşturulamadı.",
    defaultFolderName: "yeni çalışma alanı",
    presetNames: ["Kişisel", "İş", "Eğitim", "Okul"]
  },

  filePicker: {
    workspaceFilesUnavailable: "Çalışma alanı dosyaları kullanılamıyor.",
    workspaceFilesTitle: "Çalışma alanı dosyaları"
  },

  appTreeMenu: {
    openInNewTab: "Yeni sekmede aç"
  },

  spaceEntry: {
    initializationError: "Başlatma Hatası"
  },

  tabs: {
    closeTab: "Sekmeyi kapat",
    startNewConversation: "Yeni konuşma başlat",
    newConversationShortcut: "Yeni konuşma (Cmd/Ctrl + N)"
  }
};
