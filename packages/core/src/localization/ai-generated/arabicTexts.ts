import type { Texts } from "../texts";

export const arabicTexts: Partial<Texts> = {
  basics: {
    name: "الاسم",
    button: "زر",
    description: "الوصف",
    instructions: "التعليمات",
    optional: "اختياري",
    loading: "جارٍ التحميل...",
    thinking: "يفكر...",
    model: "النموذج",
    apps: "المساعدون",
  },

  messageForm: {
    placeholder: "اسأل أي شيء",
    attachFile: "إرفاق ملف",
    send: "إرسال الرسالة",
    stop: "إيقاف التوليد"
  },

  appPage: {
    title: "المساعدون",
    buttonNewConfig: "مساعد جديد",
    chatsTitle: "مساعدوك",
    description: "يمكنك هنا إنشاء مساعدي الدردشة وتعديلهم. ستظهر أزرار المساعدين في أعلى يمين الشريط الجانبي.",
    contactMessage: "ستتوفر إمكانية إنشاء أنواع أخرى من التطبيقات لاحقًا. اكتب إلى <a class=\"anchor\" href=\"mailto:d@dkury.com\">d@dkury.com</a> إذا كان لديك أفكار أو اقتراحات."
  },

  appConfigPage: {
    newConfigTitle: "مساعد جديد",
    editConfigTitle: "تعديل المساعد",
    defaultConfigTitle: "المساعد الافتراضي",
    editAssistantTitle: "تعديل المساعد",
    editAssistantButton: "تعديل المساعد",
    startChatTitle: "بدء محادثة",
    startChatDescription: "ابدأ محادثة مع هذا المساعد",
    dragToReorder: "اسحب لإعادة الترتيب (غير متاح بعد)",
    newConfigButton: "زر موضوع جديد (اختياري)",
    buttonCreate: "إنشاء",
    buttonSave: "حفظ التغييرات",
    namePlaceholder: "سمِّ المساعد",
    descriptionPlaceholder: "وصف قصير لما يفعله هذا المساعد",
    instructionsPlaceholder:
      "ابدأ بـ 'أنت ...'. وجّه الذكاء الاصطناعي كما لو كنت تكتب تعليمات لموظف جديد",
    buttonPlaceholder: "نص قصير لإجراء الزر",
    gotoNewConfig: "اذهب هنا إذا أردت إنشاء مساعد جديد",
    errorValidationRequired: "هذا الحقل مطلوب",
    errorAppConfigLoadFailure: "فشل تحميل إعدادات المساعد",
    tableCell: {
      deleteButton: "حذف",
      visibilityLabel: "إظهار/إخفاء المساعد في الشريط الجانبي",
      deleteLabel: "حذف إعدادات المساعد"
    },
    defaultConfigMessage: "هذه إعدادات المساعد الافتراضي. يمكنك تغيير النموذج الذي يستخدمه أو إنشاء مساعد جديد.",
    defaultConfigGotoNew: "مساعد جديد",
    description: "يمكنك إنشاء توجيهات النظام الخاصة بك بالاعتماد على المساعد الافتراضي. في الإصدارات القادمة من Sila ستتوفر أنواع أخرى من التطبيقات مع الأدوات وواجهات API الخارجية.",
  },

  appConfigDropdown: {
    placeholder: "اختر مساعدًا...",
    newAssistant: "مساعد جديد",
    editConfigTitle: "تعديل الإعداد",
    editAssistantLabel: (assistantName: string) => `تعديل المساعد "${assistantName}"`
  },

  modelSelection: {
    manageProviders: "إدارة مزودي النماذج",
    done: "تم",
    backToSelection: "العودة لاختيار النموذج"
  },

  settingsPage: {
    title: "الإعدادات",
    appearance: {
      title: "المظهر",
      theme: "السمة",
      language: "اللغة",
      colorScheme: "نظام الألوان",
      system: "النظام",
      dark: "داكن",
      light: "فاتح",
      switchToLightMode: "التبديل إلى الوضع الفاتح",
      switchToDarkMode: "التبديل إلى الوضع الداكن"
    },
    providers: {
      title: "مزودو النماذج",
      description: "اربط مزودي نماذج الذكاء الاصطناعي لتشغيل المساعدين. هذه هي عقول المساعدين. نوصي بالبدء بـ OpenAI أو Anthropic أو Google."
    },
    spaces: {
      title: "مساحات العمل",
      spaceCount: (count: number) => `لديك ${count} مساحة عمل`,
      manageButton: "إدارة"
    },
    developers: {
      title: "للمطورين",
      toggleDevMode: "تبديل وضع المطور"
    }
  },

  spacesPage: {
    title: "مساحات عملك",
    description: "مساحة العمل هي المكان الذي تُخزن فيه تطبيقات الذكاء الاصطناعي والبيانات الأخرى. يمكنك امتلاك عدة مساحات والتنقل بينها. مثلًا واحدة للعمل وأخرى للاستخدام الشخصي.",
    opener: {
      createTitle: "إنشاء مساحة عمل جديدة",
      createDescription: "اختر مجلدًا لمساحة العمل الجديدة. يمكن أن يكون محليًا أو متزامنًا مع iCloud أو Dropbox أو Google Drive وغيرها.",
      createButton: "إنشاء",
      openTitle: "فتح مساحة عمل",
      openDescription: "افتح مجلدًا يحتوي على مساحة عملك.",
      openButton: "فتح",
      errorCreate: "فشل إنشاء مساحة العمل",
      errorOpen: "فشل فتح مساحة العمل",
      errorOpenTitle: "فشل فتح المساحة",
      errorOpenUnknown: "حدث خطأ غير معروف أثناء فتح المساحة.",
      dialogCreateTitle: "اختر مجلدًا لمساحة عمل جديدة",
      dialogOpenTitle: "اختر مجلدًا يحتوي على مساحة عمل"
    },
    openerPageTitle: "أنشئ أو افتح مساحة عمل",
    openerPageDescription: "يمكنك إنشاء مساحة جديدة أو فتح مساحة موجودة.",
    addWorkspaceButton: "إضافة مساحة عمل",
    defaultWorkspaceName: "مساحة عمل",
    manageWorkspacesButton: "إدارة مساحات العمل"
  },

  actions: {
    open: "فتح",
    edit: "تعديل",
    delete: "حذف",
    done: "تم",
    cancel: "إلغاء",
    confirm: "تأكيد",
    close: "إغلاق",
    copy: "نسخ",
    add: "إضافة",
    update: "تحديث",
    save: "حفظ",
    saving: "جارٍ الحفظ...",
    change: "تغيير",
    choose: "اختيار",
    retry: "إعادة المحاولة",
    rename: "إعادة تسمية",
    removeFromList: "إزالة من القائمة",
    openInNewTab: "فتح في تبويب جديد",
    duplicate: "نسخ",
    connect: "اتصال",
    disconnect: "قطع الاتصال",
    configure: "إعداد",
    how: "كيف؟",
    attach: "إرفاق",
    ok: "حسنًا",
    goBack: "رجوع",
    closeAll: "إغلاق الكل",
    back: "رجوع",
    next: "التالي",
    finish: "إنهاء"
  },

  markdownTextDocument: {
    openButton: "فتح",
    loading: "جارٍ تحميل المستند...",
    loadError: "تعذر تحميل محتوى الملف.",
    openAriaLabel: (fileName: string) => `فتح المستند: ${fileName}`
  },

  markdownImage: {
    openImageAria: (fileName: string) => `فتح الصورة: ${fileName}`,
    failedToLoad: (fileUrl: string) => `فشل تحميل الملف: ${fileUrl}`
  },

  models: {
    auto: "تلقائي",
    selectModelTitle: "اختيار نموذج",
    chooseModelRequired: "اختر نموذجًا",
    invalidModelFormat: (value: string) => `تنسيق النموذج غير صالح: ${value}`,
    unknownProvider: (providerId: string) => `مزود غير معروف: ${providerId}`,
    enterModel: "أدخل النموذج",
    chooseModel: "اختر نموذجًا",
    modelNameLabel: "اسم النموذج",
    openRouterPlaceholder: "مثال: openai/gpt-4o, anthropic/claude-3-5-sonnet",
    openRouterHelp: "أدخل أي نموذج متاح على OpenRouter (مثال: openai/gpt-4o, anthropic/claude-3-5-sonnet, meta-llama/llama-3.2-90b-vision-instruct)",
    defaultOption: (label: string) => `${label} (افتراضي)`
  },

  providers: {
    connected: "متصل",
    validationFailed: "فشل التحقق. تحقق من مفتاح API أو الاتصال.",
    apiKeyValidationFailed: "فشل التحقق من مفتاح API. قد يكون غير صالح أو منتهي الصلاحية.",
    unknownError: "حدث خطأ غير معروف",
    connectionFailed: "فشل الاتصال. يرجى التحقق من الشبكة.",
    editTitle: "تعديل المزود",
    deleteTitle: "حذف المزود",
    deletePrompt: "حذف؟",
    visitWebsiteTitle: "زيارة موقع المزود"
  },

  customProviderSetup: {
    titleAdd: "إضافة مزود مخصص",
    titleEdit: "تعديل مزود مخصص",
    labelProviderName: "اسم المزود",
    labelBaseApiUrl: "عنوان API الأساسي",
    labelApiKey: "مفتاح API",
    labelModelId: "معرّف النموذج",
    labelCustomHeaders: "ترويسات مخصصة (اختياري)",
    placeholderName: "مزودي المخصص",
    placeholderBaseApiUrl: "https://api.example.com/v1",
    placeholderApiKey: "sk-...",
    placeholderModelId: "gpt-3.5-turbo",
    placeholderHeaders: "Authorization: Bearer token\nX-Custom-Header: value",
    headersHint: "سطر لكل ترويسة بصيغة 'key: value'",
    invalidHeadersFormat: "تنسيق الترويسات المخصصة غير صالح. استخدم 'key: value' سطرًا لكل واحدة.",
    saveError: "فشل حفظ إعدادات المزود",
    addModalTitle: "إضافة مزود مخصص شبيه بـ OpenAI",
    addButton: "إضافة مزود مخصص"
  },

  customProviderForm: {
    titleAdd: "إضافة مزود متوافق مع OpenAI",
    titleEdit: "تعديل مزود متوافق مع OpenAI",
    labelProviderName: "اسم المزود*",
    labelApiUrl: "عنوان API*",
    labelApiKey: "مفتاح API*",
    labelModelId: "معرّف النموذج*",
    labelCustomHeaders: "ترويسات مخصصة (اختياري)",
    placeholderName: "مزودي المخصص",
    placeholderApiUrl: "https://api.example.com/v1",
    placeholderApiKey: "sk-...",
    placeholderModelId: "gpt-3.5-turbo",
    placeholderHeaders: "Authorization: Bearer token\nContent-Type: application/json",
    hintBaseUrl: "عنوان الأساس لطلبات API ويجب أن يكون متوافقًا مع OpenAI",
    hintModelId: "حدد معرّف النموذج الذي يتطلبه هذا المزود",
    hintHeaders: "سطر لكل ترويسة بصيغة “Key: Value”",
    validationNameRequired: "اسم المزود مطلوب",
    validationApiUrlRequired: "عنوان API مطلوب",
    validationApiUrlInvalid: "تنسيق عنوان API غير صالح",
    validationApiKeyRequired: "مفتاح API مطلوب",
    validationModelIdRequired: "معرّف النموذج مطلوب",
    saveFailed: (message: string) => `فشل الحفظ: ${message}`,
    buttonUpdate: "تحديث المزود",
    buttonAddProvider: "إضافة مزود"
  },

  modelProviderSetup: {
    title: (providerName: string) => `كيفية إعداد ${providerName}`,
    openai: {
      intro: "ستحتاج إلى إدخال مفتاح لاستخدام نماذج OpenAI.",
      steps: {
        signup: "سجّل أو سجّل الدخول إلى OpenAI:",
        addCredits: "أضف رصيدًا إلى حسابك هنا",
        createKey: "أنشئ مفتاحًا سريًا جديدًا هنا",
        pasteKey: "الصق المفتاح هنا وانتظر التحقق."
      }
    },
    anthropic: {
      intro: "ستحتاج إلى إدخال مفتاح لاستخدام نماذج Anthropic.",
      steps: {
        signup: "سجّل أو سجّل الدخول إلى Anthropic:",
        createKey: "أنشئ مفتاحًا جديدًا هنا",
        pasteKey: "الصق المفتاح هنا وانتظر التحقق."
      }
    },
    groq: {
      intro: "ستحتاج إلى إدخال مفتاح لاستخدام نماذج Groq.",
      steps: {
        signup: "سجّل أو سجّل الدخول إلى Groq:",
        createKey: "أنشئ مفتاح API هنا",
        pasteKey: "الصق المفتاح هنا وانتظر التحقق."
      }
    },
    deepseek: {
      intro: "ستحتاج إلى إدخال مفتاح لاستخدام نماذج DeepSeek.",
      steps: {
        signup: "سجّل أو سجّل الدخول إلى DeepSeek:",
        createKey: "أنشئ مفتاح API هنا",
        pasteKey: "الصق المفتاح هنا وانتظر التحقق."
      }
    },
    google: {
      intro: "ستحتاج إلى إدخال مفتاح لاستخدام نماذج Google Gemini.",
      steps: {
        signup: "سجّل أو سجّل الدخول إلى Google AI Studio:",
        createKey: "أنشئ مفتاح API هنا",
        pasteKey: "الصق المفتاح هنا وانتظر التحقق."
      }
    },
    xai: {
      intro: "ستحتاج إلى إدخال مفتاح لاستخدام نماذج xAI.",
      steps: {
        signup: "سجّل أو سجّل الدخول إلى xAI:",
        createTeam: "أنشئ فريقًا وانتقل إلى صفحة مفاتيح API.",
        pasteKey: "الصق المفتاح هنا وانتظر التحقق."
      }
    },
    cohere: {
      intro: "ستحتاج إلى إدخال مفتاح لاستخدام نماذج Cohere.",
      steps: {
        signup: "سجّل أو سجّل الدخول إلى Cohere:",
        createKey: "أنشئ مفتاح API هنا",
        pasteKey: "الصق المفتاح هنا وانتظر التحقق."
      }
    },
    mistral: {
      intro: "ستحتاج إلى إدخال مفتاح لاستخدام نماذج Mistral.",
      steps: {
        signup: "سجّل أو سجّل الدخول إلى Mistral AI:",
        createKey: "أنشئ مفتاح API هنا",
        pasteKey: "الصق المفتاح هنا وانتظر التحقق."
      }
    },
    ollama: {
      intro: "تحتاج إلى تثبيت وتشغيل Ollama لاستخدام نماذجه. يمكن تشغيله محليًا وسيتصل به Sila.",
      steps: {
        download: "حمّل Ollama من",
        install: "ثبّت Ollama واضبط النموذج الذي تريد استخدامه.",
        returnAfterStart: "عد إلى هنا بعد تشغيله."
      }
    },
    openrouter: {
      intro: "ستحتاج إلى إدخال مفتاح لاستخدام واجهة OpenRouter الموحدة للوصول إلى مئات النماذج.",
      steps: {
        signup: "سجّل أو سجّل الدخول إلى OpenRouter:",
        createKey: "اذهب إلى إعدادات الحساب ثم قسم API keys لإنشاء مفتاح جديد.",
        pasteKey: "الصق المفتاح هنا وانتظر التحقق."
      }
    },
    noInstructions: "لا توجد تعليمات إعداد لهذا المزود.",
    okButton: "حسنًا"
  },

  sidebar: {
    newConversationTitle: "محادثة جديدة",
    workspaceAssetsTitle: "أصول مساحة العمل",
    assetsLabel: "الأصول"
  },

  renamingPopup: {
    newNameLabel: "اسم جديد",
    newNamePlaceholder: "أدخل اسمًا جديدًا"
  },

  wizards: {
    freshStartTitle: "مرحبًا بك في Sila",
    freshStartSubtitle: "أنشئ أو افتح مساحة عمل",
    freshStartDescription: "Sila تعمل مثل ChatGPT، لكن في Sila أنت تملك مساعديك ومحادثاتك وكل البيانات المُولدة. كلما استخدمت الذكاء الاصطناعي أكثر، زادت قيمة بياناتك — لذلك من المنطقي أن تملكها.",
    getStartedButton: "ابدأ",
    workspaceTitle: "أنشئ أو افتح مساحة عمل",
    workspaceDescription: "تُخزن مساحة العمل محادثاتك وملفاتك ومساعديك. يمكنك امتلاك عدة مساحات والتبديل بينها بسرعة.",
    spaceSetupNameTitle: "سمِّ مساحة عملك",
    spaceSetupNameLabel: "اسم مساحة العمل",
    spaceSetupNameDescription: "أعطِ مساحة العمل اسمًا لتسهيل التعرف عليها، أو تخطَّ للمتابعة بالاسم الافتراضي. يمكنك تغييره لاحقًا.",
    spaceSetupNamePlaceholder: "مساحتي",
    spaceSetupNameHint: "يمكنك اختيار اسم بسيط يوضح الغرض:",
    spaceSetupBrainsTitle: "إعداد عقول مساحة العمل",
    spaceSetupBrainsDescription: "اربط مزود نموذج واحد على الأقل لبدء استخدام Sila. نوصي بالبدء بـ OpenAI أو Anthropic أو Google.",
    spaceSetupBrainsStepTitle: "العقول",
    spaceSetupThemeStepTitle: "السمة",
    spaceSetupLookTitle: "اختر مظهر مساحة العمل",
    colorSchemeLabel: "نظام الألوان",
    themeLabel: "السمة"
  },

  noTabs: {
    setupBrainsTitle: "إعداد العقول لـ Sila",
    setupBrainsDescription: "اضبط مزود نموذج واحد على الأقل لتبدأ باستخدام Sila. نوصي بـ OpenAI أو Anthropic أو Google أولًا لامتلاكهم أقوى النماذج.",
    readyToStartMessage: "تم إعداد مزود واحد على الأقل، يمكننا بدء محادثة جديدة",
    newConversationTitle: "محادثة جديدة",
    startConversationButton: "بدء المحادثة",
    chatTitle: "دردشة",
    todoNewThread: "@TODO: أضف موضوعًا جديدًا هنا"
  },

  devPanel: {
    desktopUpdatesTitle: "تحديثات سطح المكتب",
    currentVersionLabel: "الإصدار الحالي:",
    desktopUpdatesOnly: "تحديثات سطح المكتب متاحة فقط في تطبيق سطح المكتب.",
    exitDevMode: "الخروج من وضع المطور",
    devModeStatus: (version: string) => `🚧 Sila ${version} في وضع المطور`,
    openSpaceInspector: "فتح فاحص المساحة",
    closeSpaceInspector: "إغلاق فاحص المساحة",
    versionLabel: "الإصدار",
    shellLabel: "Shell",
    clientLabel: "العميل",
    updatesLabel: "التحديثات",
    checkingUpdates: "جارٍ التحقق...",
    checkForUpdates: "تحقق من التحديثات"
  },

  fileViewer: {
    loading: "جارٍ التحميل...",
    noContent: "لا يوجد محتوى لعرضه."
  },

  chat: {
    assistantConfigIdLabel: "معرّف إعدادات المساعد:",
    unknown: "غير معروف",
    unknownError: "خطأ غير معروف",
    aiLabel: "AI",
    processing: "جارٍ المعالجة",
    messageInfoAssistant: "المساعد:",
    messageInfoModel: "النموذج:",
    messageInfoCreated: "تاريخ الإنشاء:",
    messageInfoUpdated: "تاريخ التحديث:",
    messageInfoAria: "معلومات الرسالة",
    thinking: "يفكر",
    acting: "ينفذ",
    thoughtActed: "فكر ونفذ",
    acted: "نفذ",
    thought: "فكر",
    errorLoadingAppTree: "خطأ في تحميل شجرة التطبيق",
    viewFilesAria: "عرض ملفات الدردشة",
    scrollToBottomAria: "التمرير إلى الأسفل",
    chatFilesTitle: "ملفات الدردشة"
  },

  chatControls: {
    copyMessage: "نسخ الرسالة",
    editMessage: "تعديل الرسالة",
    rerunInNewBranch: "إعادة التشغيل في فرع جديد"
  },

  fileMention: {
    noFilesFound: "لم يتم العثور على ملفات",
    loading: "جارٍ التحميل...",
    previewNotFound: "الملف غير موجود",
    previewResolveFailed: "فشل العثور على الملف",
    previewUnknownError: "خطأ غير معروف"
  },

  filesApp: {
    filesRootNotFound: "لم يتم العثور على جذر الملفات.",
    uploadFiles: "رفع ملفات",
    uploading: "جارٍ الرفع...",
    newFolder: "مجلد جديد",
    emptyFolderPrefix: "يمكنك",
    emptyFolderUpload: "رفع",
    emptyFolderOr: "أو",
    emptyFolderMove: "نقل",
    emptyFolderSuffix: "الملفات إلى هذا المجلد.",
    errorLoadingFilesRoot: "خطأ في تحميل جذر الملفات",
    filesAndFoldersLabel: "الملفات والمجلدات",
    workspaceLabel: "مساحة العمل",
    unnamedLabel: "بدون اسم",
    untitledLabel: "بدون عنوان",
    moreItems: (count: number) => `+ ${count} المزيد…`
  },

  attachments: {
    addAttachmentsAria: "إضافة مرفقات (أو لصق ملفات)",
    uploadPhotosFiles: "رفع صور وملفات",
    browseWorkspaceFiles: "استعراض ملفات مساحة العمل",
    setupProviderMessage: "قم بإعداد مزود نموذج للدردشة مع الذكاء الاصطناعي.",
    setupBrainsButton: "إعداد العقول",
    processingImage: "جارٍ معالجة الصورة...",
    processingTextFile: "جارٍ معالجة ملف النص...",
    linesLabel: "سطر",
    wordsLabel: "كلمة",
    removeAttachmentAria: "إزالة المرفق"
  },

  files: {
    loadingFile: "جارٍ التحميل...",
    noFileData: "لا توجد بيانات للملف",
    loadingPdf: "جارٍ تحميل PDF...",
    pdfLoadFailed: "فشل تحميل PDF",
    invalidReference: "مرجع ملف غير صالح",
    failedToLoad: "فشل تحميل الملف",
    failedToLoadWithMessage: (message: string) => `فشل تحميل الملف: ${message}`,
    unknownError: "خطأ غير معروف"
  },

  spaceInspector: {
    spaceLabel: "المساحة",
    openCurrentAppTree: "فتح شجرة التطبيق الحالية",
    appTreeLabel: "شجرة التطبيق",
    toggleExpandAria: "توسيع/طي",
    childrenLabel: "الأبناء:",
    addVertexAria: "إضافة عقدة جديدة",
    deleteVertexAria: "حذف عقدة",
    addPropertyLabel: "إضافة خاصية",
    propertyKeyPlaceholder: "مفتاح الخاصية",
    valuePlaceholder: "القيمة",
    typeString: "نص",
    typeNumber: "رقم",
    typeBoolean: "قيمة منطقية",
    createProperty: "إنشاء",
    createdAtLabel: "تم الإنشاء",
    appTreePropertyLabel: "شجرة التطبيق",
    windowAriaLabel: "نافذة فاحص المساحة",
    windowTitle: "فاحص المساحة",
    dragWindowAria: "اسحب النافذة",
    resizeWindowAria: "غيّر حجم النافذة"
  },

  spacesList: {
    newSpaceLabel: "مساحة جديدة",
    localSpaceLabel: "مساحة محلية",
    noSpacesFound: "لم يتم العثور على مساحات"
  },

  auth: {
    serversOfflineTitle: "الخوادم غير متاحة حاليًا",
    serversOfflineMessage: "يمكنك المتابعة محليًا للتجربة",
    continueWithGoogle: "المتابعة مع Google",
    continueWithGithub: "المتابعة مع GitHub",
    continueWithGithubComingSoon: "المتابعة مع GitHub (قريبًا)",
    continueWithX: "المتابعة مع X",
    continueWithXComingSoon: "المتابعة مع X (قريبًا)",
    signInTitle: "تسجيل الدخول",
    signInAction: "تسجيل الدخول",
    profileTitle: "الملف الشخصي",
    signOut: "تسجيل الخروج",
    userAvatarAlt: "صورة المستخدم",
    userFallbackName: "المستخدم",
    googleAlt: "Google",
    githubAlt: "GitHub",
    xAlt: "X"
  },

  updates: {
    updatesTitle: "التحديثات",
    checkForUpdates: "التحقق من التحديثات",
    checkingForUpdates: "جارٍ التحقق...",
    checkingLabel: "جارٍ التحقق من التحديثات…",
    downloadKindClientBuild: "بناء العميل",
    downloadKindElectron: "electron",
    downloadKindUpdate: "تحديث",
    downloadingLabel: (kind: string, version: string | null) => {
      const suffix = version ? ` (${version})` : "";
      return `جارٍ تنزيل ${kind}${suffix}…`;
    },
    downloadedLabel: "تم تنزيل التحديث.",
    failedLabel: "فشل التحديث."
  },

  workspaceCreate: {
    title: "سمِّ مساحة عملك",
    nameLabel: "اسم مساحة العمل",
    namePlaceholder: "مساحتي",
    nameEmptyError: "اسم مساحة العمل لا يمكن أن يكون فارغًا.",
    nameUnsupportedError: "اسم مساحة العمل يحتوي على أحرف غير مدعومة.",
    nameAlreadyExistsError: "يوجد مجلد بهذا الاسم في الموقع المحدد.",
    nameAlreadyExistsInline: "توجد مساحة عمل بهذا الاسم في المجلد المحدد.",
    nameDescription: "يمكنك اختيار اسم بسيط يصف الغرض:",
    newWorkspaceLocationLabel: "سيتم إنشاء مساحة العمل الجديدة في:",
    selectLocationPlaceholder: "اختر موقعًا",
    changeLocation: "تغيير الموقع",
    creating: "جارٍ الإنشاء...",
    createWorkspace: "إنشاء مساحة عمل",
    chooseLocationTitle: "اختر مكان إنشاء مساحة العمل",
    folderAlreadyUsedTitle: "المجلد مستخدم بالفعل",
    folderAlreadyUsedMessage: "اختر مجلدًا خارج مساحات العمل الحالية.",
    failedAccessFolderTitle: "تعذر الوصول إلى المجلد",
    failedAccessFolderMessage: "لم نتمكن من الوصول إلى المجلد المحدد.",
    failedAccessFolderUnknown: "حدث خطأ غير معروف أثناء اختيار المجلد.",
    chooseFolderError: "اختر مجلدًا لحفظ مساحة العمل.",
    cannotUseFolderTitle: "لا يمكن استخدام هذا المجلد",
    cannotUseFolderMessage: "اختر موقعًا مختلفًا لمساحة العمل.",
    failedCreateWorkspaceTitle: "فشل إنشاء مساحة العمل",
    failedCreateWorkspaceMessage: "لم نتمكن من إنشاء مساحة العمل.",
    failedCreateWorkspaceFallback: "فشل إنشاء مساحة العمل.",
    defaultFolderName: "مساحة عمل جديدة",
    presetNames: ["شخصي", "العمل", "الدراسة", "المدرسة"]
  },

  filePicker: {
    workspaceFilesUnavailable: "ملفات مساحة العمل غير متاحة.",
    workspaceFilesTitle: "ملفات مساحة العمل"
  },

  appTreeMenu: {
    openInNewTab: "فتح في تبويب جديد"
  },

  spaceEntry: {
    initializationError: "خطأ في التهيئة"
  },

  tabs: {
    closeTab: "إغلاق التبويب",
    startNewConversation: "بدء محادثة جديدة",
    newConversationShortcut: "محادثة جديدة (Cmd/Ctrl + N)"
  }
};
