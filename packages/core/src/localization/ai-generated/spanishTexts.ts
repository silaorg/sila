import type { Texts } from "../texts";

export const spanishTexts: Partial<Texts> = {
  basics: {
    name: "Nombre",
    button: "Botón",
    description: "Descripción",
    instructions: "Instrucciones",
    optional: "Opcional",
    loading: "Cargando...",
    thinking: "Pensando...",
    model: "Modelo",
    apps: "Asistentes",
  },

  messageForm: {
    placeholder: "Pregunta lo que quieras",
    attachFile: "Adjuntar archivo",
    send: "Enviar mensaje",
    stop: "Detener generación"
  },

  appPage: {
    title: "Asistentes",
    buttonNewConfig: "Nuevo asistente",
    chatsTitle: "Tus asistentes",
    description: "Aquí puedes crear y editar tus asistentes de chat. Los botones de asistentes aparecerán en la parte superior derecha de la barra lateral.",
    contactMessage: "La opción de crear otros tipos de apps llegará más adelante. Escribe a <a class=\"anchor\" href=\"mailto:d@dkury.com\">d@dkury.com</a> si tienes ideas o sugerencias."
  },

  appConfigPage: {
    newConfigTitle: "Nuevo asistente",
    editConfigTitle: "Editar asistente",
    defaultConfigTitle: "Asistente predeterminado",
    editAssistantTitle: "Editar asistente",
    editAssistantButton: "Editar asistente",
    startChatTitle: "Iniciar chat",
    startChatDescription: "Inicia un chat con este asistente",
    dragToReorder: "Arrastra para reordenar (aún no implementado)",
    newConfigButton: "Botón de nuevo hilo (opcional)",
    buttonCreate: "Crear",
    buttonSave: "Guardar cambios",
    namePlaceholder: "Ponle un nombre a tu asistente",
    descriptionPlaceholder: "Una breve descripción de lo que hace este asistente",
    instructionsPlaceholder:
      "Empieza con “Eres un...”. Instruye a la IA como si fuera un nuevo empleado",
    buttonPlaceholder: "Texto corto de acción para el botón",
    gotoNewConfig: "Ve aquí si quieres crear un nuevo asistente",
    errorValidationRequired: "Este campo es obligatorio",
    errorAppConfigLoadFailure: "No se pudo cargar la configuración del asistente",
    tableCell: {
      deleteButton: "Eliminar",
      visibilityLabel: "Mostrar/ocultar el asistente en la barra lateral",
      deleteLabel: "Eliminar la configuración del asistente"
    },
    defaultConfigMessage: "Esta es la configuración del asistente predeterminado. Puedes cambiar el modelo que usa o crear un nuevo asistente.",
    defaultConfigGotoNew: "Nuevo asistente",
    description: "Puedes crear tus propios prompts del sistema (instrucciones) basados en el asistente predeterminado. En futuras versiones de Sila se podrán crear otros tipos de apps con herramientas y APIs externas.",
  },

  defaultAppConfig: {
    name: "Chat",
    button: "Nueva consulta",
    description: "Un asistente de chat básico",
    instructions:
      "Eres Sila, un asistente de IA. Sé directo en todas las respuestas. Usa un lenguaje simple. Evita cortesías, relleno y formalidad.",
  },

  appConfigDropdown: {
    placeholder: "Selecciona un asistente...",
    newAssistant: "Nuevo asistente",
    editConfigTitle: "Editar configuración",
    editAssistantLabel: (assistantName: string) => `Editar asistente "${assistantName}"`
  },

  modelSelection: {
    manageProviders: "Gestionar proveedores de modelos",
    done: "Listo",
    backToSelection: "Volver a la selección de modelo"
  },

  settingsPage: {
    title: "Configuración",
    appearance: {
      title: "Apariencia",
      theme: "Tema",
      themeDescription: "Elige un tema de color para tu espacio de trabajo.",
      language: "Idioma",
      colorScheme: "Esquema de color",
      system: "Sistema",
      dark: "Oscuro",
      light: "Claro",
      switchToLightMode: "Cambiar a modo claro",
      switchToDarkMode: "Cambiar a modo oscuro"
    },
    providers: {
      title: "Proveedores de modelos",
      description: "Conecta proveedores de modelos de IA para impulsar tus asistentes. Son el cerebro de tus asistentes. Recomendamos configurar OpenAI, Anthropic o Google primero."
    },
    sidebar: {
      workspaceTitle: "Espacio de trabajo",
      workspacePreferencesTitle: "Preferencias del espacio de trabajo",
      workspacePreferencesLabel: "Preferencias",
      appTitle: "App"
    },
    workspacePreferences: {
      description: "Describe tu espacio de trabajo para la IA y elige el idioma de la interfaz y de la IA.",
      descriptionLabel: "Descripción del espacio de trabajo",
      descriptionPlaceholder: "Describe para qué sirve este espacio de trabajo o las preferencias de los asistentes en texto plano.",
      storedPathLabel: "Este espacio de trabajo se guarda en:",
      revealButton: "Mostrar",
      noWorkspaceLoaded: "No hay ningún espacio de trabajo cargado.",
      notStoredOnDiskError: "Este espacio de trabajo no está almacenado en el disco.",
      revealUnsupportedError: "Mostrar no está disponible en esta versión.",
      revealFailedError: "No se pudo mostrar la ruta del espacio de trabajo."
    },
    workspacePrivacySync: {
      storageTitle: "Almacenamiento",
      workspaceLocationLabel: "Ubicación del espacio de trabajo:",
      noWorkspaceLoaded: "No hay ningún espacio de trabajo cargado.",
      syncPlaceholder: "La configuración de sincronización estará disponible pronto."
    },
    personalization: {
      title: "Perfil de usuario",
      description: "Los detalles del perfil y las preferencias de personalización estarán disponibles pronto.",
      openProfile: "Abrir perfil",
      signInPlaceholder: "Las opciones de inicio de sesión aparecerán aquí cuando la autenticación esté habilitada."
    },
    spaces: {
      title: "Espacios de trabajo",
      spaceCount: (count: number) => `Tienes ${count === 1 ? "1 espacio de trabajo" : `${count} espacios de trabajo`}`,
      manageButton: "Gestionar"
    },
    developers: {
      title: "Para desarrolladores",
      toggleDevMode: "Activar modo desarrollador"
    }
  },

  spacesPage: {
    title: "Tus espacios de trabajo",
    description: "Un espacio de trabajo es donde se guardan tus apps de IA y otros datos. Puedes tener varios y cambiar entre ellos. Por ejemplo, uno para trabajo y otro personal.",
    opener: {
      createTitle: "Crear un nuevo espacio de trabajo",
      createDescription: "Elige una carpeta para tu nuevo espacio. Puede ser local o sincronizada con iCloud, Dropbox, Google Drive, etc.",
      createButton: "Crear",
      openTitle: "Abrir un espacio de trabajo",
      openDescription: "Abre una carpeta que contenga tu espacio.",
      openButton: "Abrir",
      errorCreate: "No se pudo crear el espacio de trabajo",
      errorOpen: "No se pudo abrir el espacio de trabajo",
      errorOpenTitle: "No se pudo abrir el espacio",
      errorOpenUnknown: "Se produjo un error desconocido al abrir el espacio.",
      dialogCreateTitle: "Selecciona una carpeta para un nuevo espacio de trabajo",
      dialogOpenTitle: "Selecciona una carpeta con un espacio de trabajo"
    },
    openerPageTitle: "Crea o abre tu espacio de trabajo",
    openerPageDescription: "Puedes crear un nuevo espacio o abrir uno existente.",
    addWorkspaceButton: "Añadir espacio de trabajo",
    defaultWorkspaceName: "Espacio de trabajo",
    manageWorkspacesButton: "Gestionar espacios de trabajo"
  },

  actions: {
    open: "Abrir",
    edit: "Editar",
    delete: "Eliminar",
    done: "Listo",
    cancel: "Cancelar",
    confirm: "Confirmar",
    close: "Cerrar",
    copy: "Copiar",
    add: "Añadir",
    update: "Actualizar",
    save: "Guardar",
    saving: "Guardando...",
    change: "Cambiar",
    choose: "Elegir",
    retry: "Reintentar",
    rename: "Renombrar",
    removeFromList: "Quitar de la lista",
    openInNewTab: "Abrir en una nueva pestaña",
    duplicate: "Duplicar",
    connect: "Conectar",
    disconnect: "Desconectar",
    configure: "Configurar",
    how: "¿Cómo?",
    attach: "Adjuntar",
    ok: "OK",
    goBack: "Volver",
    closeAll: "Cerrar todo",
    back: "Atrás",
    next: "Siguiente",
    finish: "Finalizar"
  },

  markdownTextDocument: {
    openButton: "Abrir",
    loading: "Cargando documento...",
    loadError: "No se pudo cargar el contenido del archivo.",
    openAriaLabel: (fileName: string) => `Abrir documento: ${fileName}`
  },

  markdownImage: {
    openImageAria: (fileName: string) => `Abrir imagen: ${fileName}`,
    failedToLoad: (fileUrl: string) => `No se pudo cargar el archivo: ${fileUrl}`
  },

  models: {
    auto: "Auto",
    selectModelTitle: "Seleccionar modelo",
    chooseModelRequired: "Elige un modelo",
    invalidModelFormat: (value: string) => `Formato de modelo inválido: ${value}`,
    unknownProvider: (providerId: string) => `Proveedor desconocido: ${providerId}`,
    enterModel: "Introduce el modelo",
    chooseModel: "Elegir modelo",
    modelNameLabel: "Nombre del modelo",
    openRouterPlaceholder: "p. ej., openai/gpt-4o, anthropic/claude-3-5-sonnet",
    openRouterHelp: "Introduce cualquier modelo disponible en OpenRouter (p. ej., openai/gpt-4o, anthropic/claude-3-5-sonnet, meta-llama/llama-3.2-90b-vision-instruct)",
    defaultOption: (label: string) => `${label} (predeterminado)`
  },

  providers: {
    connected: "Conectado",
    validationFailed: "La validación falló. Revisa tu API key o la conexión.",
    apiKeyValidationFailed: "La validación de la API key falló. La clave puede ser inválida o haber expirado.",
    unknownError: "Ocurrió un error desconocido",
    connectionFailed: "Falló la conexión. Revisa tu red.",
    editTitle: "Editar proveedor",
    deleteTitle: "Eliminar proveedor",
    deletePrompt: "¿Eliminar?",
    visitWebsiteTitle: "Visitar sitio del proveedor"
  },

  customProviderSetup: {
    titleAdd: "Añadir proveedor personalizado",
    titleEdit: "Editar proveedor personalizado",
    labelProviderName: "Nombre del proveedor",
    labelBaseApiUrl: "URL base de la API",
    labelApiKey: "API key",
    labelModelId: "ID del modelo",
    labelCustomHeaders: "Encabezados personalizados (opcional)",
    placeholderName: "Mi proveedor personalizado",
    placeholderBaseApiUrl: "https://api.example.com/v1",
    placeholderApiKey: "sk-...",
    placeholderModelId: "gpt-3.5-turbo",
    placeholderHeaders: "Authorization: Bearer token\nX-Custom-Header: value",
    headersHint: "Un encabezado por línea en formato 'key: value'",
    invalidHeadersFormat: "Formato inválido. Usa 'key: value', uno por línea.",
    saveError: "No se pudo guardar la configuración del proveedor",
    addModalTitle: "Añadir proveedor personalizado tipo OpenAI",
    addButton: "Añadir proveedor personalizado"
  },

  customProviderForm: {
    titleAdd: "Añadir proveedor compatible con OpenAI",
    titleEdit: "Editar proveedor compatible con OpenAI",
    labelProviderName: "Nombre del proveedor*",
    labelApiUrl: "URL de la API*",
    labelApiKey: "API key*",
    labelModelId: "ID del modelo*",
    labelCustomHeaders: "Encabezados personalizados (opcional)",
    placeholderName: "Mi proveedor personalizado",
    placeholderApiUrl: "https://api.example.com/v1",
    placeholderApiKey: "sk-...",
    placeholderModelId: "gpt-3.5-turbo",
    placeholderHeaders: "Authorization: Bearer token\nContent-Type: application/json",
    hintBaseUrl: "La URL base para llamadas API, compatible con OpenAI",
    hintModelId: "Indica el ID de modelo que requiere el proveedor",
    hintHeaders: "Un encabezado por línea en formato “Key: Value”",
    validationNameRequired: "El nombre del proveedor es obligatorio",
    validationApiUrlRequired: "La URL de la API es obligatoria",
    validationApiUrlInvalid: "Formato de URL inválido",
    validationApiKeyRequired: "La API key es obligatoria",
    validationModelIdRequired: "El ID del modelo es obligatorio",
    saveFailed: (message: string) => `No se pudo guardar: ${message}`,
    buttonUpdate: "Actualizar proveedor",
    buttonAddProvider: "Añadir proveedor"
  },

  modelProviderSetup: {
    title: (providerName: string) => `Cómo configurar ${providerName}`,
    openai: {
      intro: "Necesitas una clave para usar los modelos de OpenAI.",
      steps: {
        signup: "Regístrate o inicia sesión en OpenAI:",
        addCredits: "Añade saldo aquí",
        createKey: "Crea una nueva clave secreta aquí",
        pasteKey: "Pega la clave y espera la validación."
      }
    },
    anthropic: {
      intro: "Necesitas una clave para usar los modelos de Anthropic.",
      steps: {
        signup: "Regístrate o inicia sesión en Anthropic:",
        createKey: "Crea una nueva clave aquí",
        pasteKey: "Pega la clave y espera la validación."
      }
    },
    groq: {
      intro: "Necesitas una clave para usar los modelos de Groq.",
      steps: {
        signup: "Regístrate o inicia sesión en Groq:",
        createKey: "Crea una API key aquí",
        pasteKey: "Pega la clave y espera la validación."
      }
    },
    deepseek: {
      intro: "Necesitas una clave para usar los modelos de DeepSeek.",
      steps: {
        signup: "Regístrate o inicia sesión en DeepSeek:",
        createKey: "Crea una API key aquí",
        pasteKey: "Pega la clave y espera la validación."
      }
    },
    google: {
      intro: "Necesitas una clave para usar los modelos de Google Gemini.",
      steps: {
        signup: "Regístrate o inicia sesión en Google AI Studio:",
        createKey: "Crea una API key aquí",
        pasteKey: "Pega la clave y espera la validación."
      }
    },
    xai: {
      intro: "Necesitas una clave para usar los modelos de xAI.",
      steps: {
        signup: "Regístrate o inicia sesión en xAI:",
        createTeam: "Crea un equipo y ve a la página de API keys.",
        pasteKey: "Pega la clave y espera la validación."
      }
    },
    cohere: {
      intro: "Necesitas una clave para usar los modelos de Cohere.",
      steps: {
        signup: "Regístrate o inicia sesión en Cohere:",
        createKey: "Crea una API key aquí",
        pasteKey: "Pega la clave y espera la validación."
      }
    },
    mistral: {
      intro: "Necesitas una clave para usar los modelos de Mistral.",
      steps: {
        signup: "Regístrate o inicia sesión en Mistral AI:",
        createKey: "Crea una API key aquí",
        pasteKey: "Pega la clave y espera la validación."
      }
    },
    ollama: {
      intro: "Debes instalar y ejecutar Ollama para usar sus modelos. Puedes ejecutarlo localmente y Sila se conectará.",
      steps: {
        download: "Descarga Ollama desde",
        install: "Instala Ollama y configura el modelo que quieras usar.",
        returnAfterStart: "Vuelve aquí después de iniciarlo."
      }
    },
    openrouter: {
      intro: "Necesitas una clave para usar la API unificada de OpenRouter y acceder a cientos de modelos.",
      steps: {
        signup: "Regístrate o inicia sesión en OpenRouter:",
        createKey: "En la configuración de tu cuenta, ve a API keys y crea una nueva clave.",
        pasteKey: "Pega la clave y espera la validación."
      }
    },
    noInstructions: "No hay instrucciones disponibles para este proveedor.",
    okButton: "OK"
  },

  sidebar: {
    newConversationTitle: "Nueva conversación",
    workspaceAssetsTitle: "Recursos del espacio de trabajo",
    assetsLabel: "Recursos"
  },

  renamingPopup: {
    newNameLabel: "Nuevo nombre",
    newNamePlaceholder: "Introduce un nuevo nombre"
  },

  wizards: {
    freshStartTitle: "Bienvenido a Sila",
    freshStartSubtitle: "Crea o abre un espacio de trabajo",
    freshStartDescription: "Sila funciona como ChatGPT, pero en Sila tú eres dueño de tus asistentes, chats y todos los datos generados. Cuanto más uses la IA y más aprenda de ti, más valiosos son esos datos, así que tiene sentido que sean tuyos.",
    getStartedButton: "Empezar",
    workspaceTitle: "Crea o abre un espacio de trabajo",
    workspaceDescription: "Un espacio de trabajo guarda tus conversaciones, archivos y asistentes. Puedes tener varios y cambiar entre ellos rápidamente.",
    spaceSetupNameTitle: "Ponle nombre a tu espacio",
    spaceSetupNameLabel: "Nombre del espacio",
    spaceSetupNameDescription: "Ponle un nombre para identificarlo o continúa con el nombre predeterminado. Siempre puedes cambiarlo después.",
    spaceSetupNamePlaceholder: "Mi espacio",
    spaceSetupNameHint: "Puedes usar un nombre simple que describa el propósito:",
    spaceSetupBrainsTitle: "Configura los cerebros de tu espacio",
    spaceSetupBrainsDescription: "Conecta al menos un proveedor de modelos de IA para empezar a usar Sila. Recomendamos OpenAI, Anthropic o Google.",
    spaceSetupBrainsStepTitle: "Cerebros",
    spaceSetupSearchTitle: "Configura la búsqueda para tu espacio (opcional)",
    spaceSetupSearchDescription: "Conecta un proveedor de búsqueda para que tus asistentes puedan buscar en la web. Es opcional y puedes omitirlo por ahora.",
    spaceSetupSearchStepTitle: "Búsqueda",
    spaceSetupThemeStepTitle: "Tema",
    spaceSetupLookTitle: "Elige el aspecto de tu espacio",
    colorSchemeLabel: "Esquema de color",
    themeLabel: "Tema"
  },

  noTabs: {
    setupBrainsTitle: "Configura los cerebros para Sila",
    setupBrainsDescription: "Configura al menos un proveedor de modelos de IA para empezar a usar Sila. Recomendamos OpenAI, Anthropic o Google primero: tienen los modelos más potentes.",
    readyToStartMessage: "Ya hay al menos un proveedor configurado, podemos iniciar una nueva conversación",
    newConversationTitle: "Nueva conversación",
    startConversationButton: "Iniciar conversación",
    chatTitle: "Chat",
    todoNewThread: "@TODO: añadir nuevo hilo aquí"
  },

  devPanel: {
    desktopUpdatesTitle: "Actualizaciones de escritorio",
    currentVersionLabel: "Versión actual:",
    desktopUpdatesOnly: "Las actualizaciones de escritorio solo están disponibles en la app de escritorio.",
    exitDevMode: "Salir del modo desarrollador",
    devModeStatus: (version: string) => `🚧 Sila ${version} en modo desarrollador`,
    openSpaceInspector: "Abrir inspector de espacio",
    closeSpaceInspector: "Cerrar inspector de espacio",
    versionLabel: "Versión",
    shellLabel: "Shell",
    clientLabel: "Cliente",
    updatesLabel: "Actualizaciones",
    checkingUpdates: "Comprobando...",
    checkForUpdates: "Buscar actualizaciones"
  },

  fileViewer: {
    loading: "Cargando...",
    noContent: "No hay contenido para mostrar."
  },

  chat: {
    assistantConfigIdLabel: "ID de configuración del asistente:",
    unknown: "desconocido",
    unknownError: "Error desconocido",
    aiLabel: "IA",
    processing: "Procesando",
    messageInfoAssistant: "Asistente:",
    messageInfoModel: "Modelo:",
    messageInfoCreated: "Creado:",
    messageInfoUpdated: "Actualizado:",
    messageInfoAria: "Información del mensaje",
    thinking: "Pensando",
    acting: "Actuando",
    thoughtActed: "Pensó y actuó",
    acted: "Actuó",
    thought: "Pensó",
    errorLoadingAppTree: "Error al cargar el árbol de la app",
    viewFilesAria: "Ver archivos del chat",
    scrollToBottomAria: "Desplazar al final",
    chatFilesTitle: "Archivos del chat"
  },

  chatControls: {
    copyMessage: "Copiar mensaje",
    editMessage: "Editar mensaje",
    rerunInNewBranch: "Reejecutar en una nueva rama"
  },

  fileMention: {
    noFilesFound: "No se encontraron archivos",
    loading: "Cargando...",
    previewNotFound: "Archivo no encontrado",
    previewResolveFailed: "No se pudo resolver el archivo",
    previewUnknownError: "Error desconocido"
  },

  filesApp: {
    filesRootNotFound: "No se encontró la raíz de archivos.",
    uploadFiles: "Subir archivos",
    uploading: "Subiendo...",
    newFolder: "Nueva carpeta",
    emptyFolderPrefix: "Puedes",
    emptyFolderUpload: "subir",
    emptyFolderOr: "o",
    emptyFolderMove: "mover",
    emptyFolderSuffix: "archivos a esta carpeta.",
    errorLoadingFilesRoot: "Error al cargar la raíz de archivos",
    filesAndFoldersLabel: "Archivos y carpetas",
    workspaceLabel: "Espacio de trabajo",
    unnamedLabel: "Sin nombre",
    untitledLabel: "Sin título",
    moreItems: (count: number) => `+ ${count} más…`
  },

  attachments: {
    addAttachmentsAria: "Añadir adjuntos (o pegar archivos)",
    uploadPhotosFiles: "Subir fotos y archivos",
    browseWorkspaceFiles: "Explorar archivos del espacio",
    setupProviderMessage: "Configura un proveedor de modelos para chatear con la IA.",
    setupBrainsButton: "Configurar cerebros",
    processingImage: "Procesando imagen...",
    processingTextFile: "Procesando archivo de texto...",
    linesLabel: "líneas",
    wordsLabel: "palabras",
    removeAttachmentAria: "Eliminar adjunto"
  },

  files: {
    loadingFile: "Cargando...",
    noFileData: "Sin datos del archivo",
    loadingPdf: "Cargando PDF...",
    pdfLoadFailed: "No se pudo cargar el PDF",
    invalidReference: "Referencia de archivo inválida",
    failedToLoad: "No se pudo cargar el archivo",
    failedToLoadWithMessage: (message: string) => `No se pudo cargar el archivo: ${message}`,
    unknownError: "Error desconocido"
  },

  spaceInspector: {
    spaceLabel: "Espacio",
    openCurrentAppTree: "Abrir árbol de la app actual",
    appTreeLabel: "Árbol de la app",
    toggleExpandAria: "Expandir/contraer",
    childrenLabel: "hijos:",
    addVertexAria: "Añadir nuevo nodo",
    deleteVertexAria: "Eliminar nodo",
    addPropertyLabel: "Añadir propiedad",
    propertyKeyPlaceholder: "Clave de propiedad",
    valuePlaceholder: "Valor",
    typeString: "Texto",
    typeNumber: "Número",
    typeBoolean: "Booleano",
    createProperty: "Crear",
    createdAtLabel: "creado",
    appTreePropertyLabel: "árbol de la app",
    windowAriaLabel: "Ventana del inspector de espacio",
    windowTitle: "Inspector de espacio",
    dragWindowAria: "Arrastrar ventana",
    resizeWindowAria: "Redimensionar ventana"
  },

  spacesList: {
    newSpaceLabel: "Nuevo espacio",
    localSpaceLabel: "Espacio local",
    noSpacesFound: "No se encontraron espacios"
  },

  auth: {
    serversOfflineTitle: "Los servidores están fuera de línea",
    serversOfflineMessage: "Puedes continuar en modo local para probar",
    continueWithGoogle: "Continuar con Google",
    continueWithGithub: "Continuar con GitHub",
    continueWithGithubComingSoon: "Continuar con GitHub (próximamente)",
    continueWithX: "Continuar con X",
    continueWithXComingSoon: "Continuar con X (próximamente)",
    signInTitle: "Iniciar sesión",
    signInAction: "Iniciar sesión",
    profileTitle: "Perfil",
    signOut: "Cerrar sesión",
    userAvatarAlt: "Avatar de usuario",
    userFallbackName: "Usuario",
    googleAlt: "Google",
    githubAlt: "GitHub",
    xAlt: "X"
  },

  updates: {
    updatesTitle: "Actualizaciones",
    checkForUpdates: "Buscar actualizaciones",
    checkingForUpdates: "Comprobando...",
    checkingLabel: "Comprobando actualizaciones…",
    downloadKindClientBuild: "compilación del cliente",
    downloadKindElectron: "electron",
    downloadKindUpdate: "actualización",
    downloadingLabel: (kind: string, version: string | null) => {
      const suffix = version ? ` (${version})` : "";
      return `Descargando ${kind}${suffix}…`;
    },
    downloadedLabel: "Actualización descargada.",
    failedLabel: "Falló la actualización."
  },

  workspaceCreate: {
    title: "Nombra tu espacio",
    nameLabel: "Nombre del espacio",
    namePlaceholder: "Mi espacio",
    nameEmptyError: "El nombre no puede estar vacío.",
    nameUnsupportedError: "El nombre contiene caracteres no admitidos.",
    nameAlreadyExistsError: "Ya existe una carpeta con ese nombre en la ubicación seleccionada.",
    nameAlreadyExistsInline: "Ya existe un espacio con ese nombre en la carpeta seleccionada.",
    nameDescription: "Puedes dar un nombre simple que describa su propósito:",
    newWorkspaceLocationLabel: "Tu nuevo espacio se creará en:",
    selectLocationPlaceholder: "Selecciona una ubicación",
    changeLocation: "Cambiar ubicación",
    creating: "Creando...",
    createWorkspace: "Crear espacio",
    chooseLocationTitle: "Elige dónde crear tu espacio",
    folderAlreadyUsedTitle: "Carpeta ya usada",
    folderAlreadyUsedMessage: "Elige una carpeta fuera de espacios existentes.",
    failedAccessFolderTitle: "No se pudo acceder a la carpeta",
    failedAccessFolderMessage: "No pudimos acceder a la carpeta seleccionada.",
    failedAccessFolderUnknown: "Se produjo un error desconocido al elegir la carpeta.",
    chooseFolderError: "Elige una carpeta para guardar el espacio.",
    cannotUseFolderTitle: "No se puede usar esta carpeta",
    cannotUseFolderMessage: "Elige otra ubicación para tu espacio.",
    failedCreateWorkspaceTitle: "No se pudo crear el espacio",
    failedCreateWorkspaceMessage: "No pudimos crear el espacio.",
    failedCreateWorkspaceFallback: "No se pudo crear el espacio.",
    defaultFolderName: "nuevo espacio",
    presetNames: ["Personal", "Trabajo", "Estudios", "Escuela"]
  },

  filePicker: {
    workspaceFilesUnavailable: "Los archivos del espacio no están disponibles.",
    workspaceFilesTitle: "Archivos del espacio"
  },

  appTreeMenu: {
    openInNewTab: "Abrir en una nueva pestaña"
  },

  spaceEntry: {
    initializationError: "Error de inicialización"
  },

  tabs: {
    closeTab: "Cerrar pestaña",
    startNewConversation: "Iniciar nueva conversación",
    newConversationShortcut: "Nueva conversación (Cmd/Ctrl + N)"
  }
};
