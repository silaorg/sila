import { SWins } from "../swins/Swins.svelte";
import Settings from "../swins/routes/Settings.svelte";
import SettingsAppearance from "../swins/routes/SettingsAppearance.svelte";
import SettingsProviders from "../swins/routes/SettingsProviders.svelte";
import SettingsAssistants from "../swins/routes/SettingsAssistants.svelte";
import SettingsWorkspaces from "../swins/routes/SettingsWorkspaces.svelte";
import SettingsAboutSila from "../swins/routes/SettingsAboutSila.svelte";
import SettingsDev from "../swins/routes/SettingsDev.svelte";
import SettingsWorkspacePreferences from "../swins/routes/SettingsWorkspacePreferences.svelte";
import SettingsWorkspacePrivacySync from "../swins/routes/SettingsWorkspacePrivacySync.svelte";
import SettingsAppPersonalization from "../swins/routes/SettingsAppPersonalization.svelte";
import Spaces from "../swins/routes/Spaces.svelte";
import Apps from "../swins/routes/Apps.svelte";
import AppConfigEditing from "@sila/client/comps/configs/AppConfigEditing.svelte";
import NewThreadSwins from "../swins/routes/NewThreadSwins.svelte";
import HowToSetupModelProvider from "@sila/client/comps/models/HowToSetupModelProvider.svelte";
import SelectModelPopup from "@sila/client/comps/popups/SelectModelPopup.svelte";
import CustomProviderSetup from "@sila/client/comps/models/CustomProviderSetup.svelte";
import ModelProviders from "@sila/client/comps/models/ModelProviders.svelte";
import SignInButtons from "@sila/client/comps/auth/SignInButtons.svelte";
import UserProfile from "@sila/client/comps/auth/UserProfile.svelte";
import SpaceOpenerPage from "../comps/spaces/SpaceOpenerPage.svelte";
import DesktopUpdates from "@sila/client/comps/dev/DesktopUpdates.svelte";
import CreateWorkspace from "../swins/routes/CreateWorkspace.svelte";
import FilesAppLoader from "../comps/apps/files/FilesAppLoader.svelte";
import FilePickerSwin from "../swins/routes/FilePickerSwin.svelte";
import { type Component } from "svelte";

interface SwinsComponent {
  key: string;
  target: Component;
}

export const swinsLayout = {
  settings: {
    key: 'settings',
    target: Settings,
  },
  settingsWorkspacePreferences: {
    key: 'settings-workspace-preferences',
    target: SettingsWorkspacePreferences,
  },
  settingsAppearance: {
    key: 'settings-appearance',
    target: SettingsAppearance,
  },
  settingsProviders: {
    key: 'settings-providers',
    target: SettingsProviders,
  },
  settingsAssistants: {
    key: 'settings-assistants',
    target: SettingsAssistants,
  },
  settingsWorkspacePrivacySync: {
    key: 'settings-workspace-privacy-sync',
    target: SettingsWorkspacePrivacySync,
  },
  settingsAppPersonalization: {
    key: 'settings-app-personalization',
    target: SettingsAppPersonalization,
  },
  settingsWorkspaces: {
    key: 'settings-workspaces',
    target: SettingsWorkspaces,
  },
  settingsAboutSila: {
    key: 'settings-about-sila',
    target: SettingsAboutSila,
  },
  settingsDev: {
    key: 'settings-dev',
    target: SettingsDev,
  },
  spaces: {
    key: 'spaces',
    target: Spaces,
  },
  openSpace: {
    key: 'open-space',
    target: SpaceOpenerPage,
  },
  createWorkspace: {
    key: 'create-workspace',
    target: CreateWorkspace,
  },
  apps: {
    key: 'apps',
    target: Apps,
  },
  appConfig: {
    key: 'app-config',
    target: AppConfigEditing,
  },
  newThread: {
    key: 'new-thread',
    target: NewThreadSwins,
  },
  howToSetupModelProvider: {
    key: 'how-to-setup-model-provider',
    target: HowToSetupModelProvider,
  },
  selectModel: {
    key: 'select-model',
    target: SelectModelPopup,
  },
  customProviderSetup: {
    key: 'custom-provider-setup',
    target: CustomProviderSetup,
  },
  modelProviders: {
    key: 'model-providers',
    target: ModelProviders,
  },
  signIn: {
    key: 'sign-in',
    target: SignInButtons,
  },
  userProfile: {
    key: 'user-profile',
    target: UserProfile,
  },
  desktopUpdates: {
    key: 'desktop-updates',
    target: DesktopUpdates,
  },
  files: {
    key: 'files',
    target: FilesAppLoader,
  },
  filePicker: {
    key: 'file-picker',
    target: FilePickerSwin,
  },
} satisfies Record<string, SwinsComponent>;

export type SwinsKey = keyof typeof swinsLayout;

// Setup function that can configure any SWins instance
export function setupSwins(): SWins {
  const swins = new SWins();

  // Break swinsLayout into values
  for (const swinsComp of Object.values(swinsLayout)) {
    swins.register(swinsComp.key, swinsComp.target);
  }

  return swins;
}
