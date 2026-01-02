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
    contactMessage: string;
  }

  appConfigPage: {
    newConfigTitle: string;
    editConfigTitle: string;
    defaultConfigTitle: string;
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
      dialogCreateTitle: string;
      dialogOpenTitle: string;
    }
  }
}
