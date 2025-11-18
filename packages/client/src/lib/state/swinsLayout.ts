import { SWins } from "../swins/Swins.svelte";
import Settings from "../swins/routes/Settings.svelte";
import SettingsAppearance from "../swins/routes/SettingsAppearance.svelte";
import SettingsProviders from "../swins/routes/SettingsProviders.svelte";
import SettingsAssistants from "../swins/routes/SettingsAssistants.svelte";
import SettingsWorkspaces from "../swins/routes/SettingsWorkspaces.svelte";
import SettingsDev from "../swins/routes/SettingsDev.svelte";
import Spaces from "../swins/routes/Spaces.svelte";
import Apps from "../swins/routes/Apps.svelte";
import AppConfigEditing from "@sila/client/comps/configs/AppConfigEditing.svelte";
import NewThreadSwins from "../swins/routes/NewThreadSwins.svelte";
import HowToSetupModelProider from "@sila/client/comps/models/HowToSetupModelProider.svelte";
import SelectModelPopup from "@sila/client/comps/popups/SelectModelPopup.svelte";
import CustomProviderSetup from "@sila/client/comps/models/CustomProviderSetup.svelte";
import ModelProviders from "@sila/client/comps/models/ModelProviders.svelte";
import SignInButtons from "@sila/client/comps/auth/SignInButtons.svelte";
import UserProfile from "@sila/client/comps/auth/UserProfile.svelte";
import SpaceOpenerPage from "../comps/spaces/SpaceOpenerPage.svelte";
import DesktopUpdates from "@sila/client/comps/dev/DesktopUpdates.svelte";
import CreateWorkspace from "../swins/routes/CreateWorkspace.svelte";
import FilesAppLoader from "../comps/apps/files/FilesAppLoader.svelte";

// Setup function that can configure any SWins instance
export function setupSwins(): SWins {
  const swins = new SWins();

  swins.register('settings', Settings);
  swins.register('settings-appearance', SettingsAppearance);
  swins.register('settings-providers', SettingsProviders);
  swins.register('settings-assistants', SettingsAssistants);
  swins.register('settings-workspaces', SettingsWorkspaces);
  swins.register('settings-dev', SettingsDev);
  swins.register('spaces', Spaces);
  swins.register('open-space', SpaceOpenerPage);
  swins.register('create-workspace', CreateWorkspace);
  swins.register('apps', Apps);
  swins.register('app-config', AppConfigEditing);
  swins.register('new-thread', NewThreadSwins);
  swins.register('how-to-setup-model-provider', HowToSetupModelProider);
  swins.register('select-model', SelectModelPopup);
  swins.register('custom-provider-setup', CustomProviderSetup);
  swins.register('model-providers', ModelProviders);
  swins.register('sign-in', SignInButtons);
  swins.register('user-profile', UserProfile);
  swins.register('desktop-updates', DesktopUpdates);
  swins.register('files', FilesAppLoader);

  return swins;
}