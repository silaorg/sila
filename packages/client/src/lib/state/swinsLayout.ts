import { SWins } from "../swins/Swins.svelte";
import Settings from "../swins/routes/Settings.svelte";
import Spaces from "../swins/routes/Spaces.svelte";
import Apps from "../swins/routes/Apps.svelte";
import AppConfigEditing from "@sila/client/comps/app-configs/AppConfigEditing.svelte";
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
import FilesAppLoader from "../comps/apps/FilesAppLoader.svelte";

// Setup function that can configure any SWins instance
export function setupSwins(): SWins {
  const swins = new SWins();

  swins.register('settings', Settings);
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