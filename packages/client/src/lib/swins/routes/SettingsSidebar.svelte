<script lang="ts">
  import SwinsNavButton from "../SwinsNavButton.svelte";
  import {
    Cpu,
    Bot,
    FolderOpen,
    Code,
    Settings,
    Palette,
    Shield,
  } from "lucide-svelte";
  import { i18n } from "@sila/client";
  import { useClientState } from "@sila/client/state/clientStateContext";
  
  const clientState = useClientState();
  const swins = $derived(clientState.layout.swins);
  
  // Detect active componentId from current window
  let activeComponentId = $derived.by(() => {
    if (swins.windows.length === 0) return undefined;
    const currentWindow = swins.windows[swins.windows.length - 1];
    return currentWindow.componentId;
  });
</script>

<nav class="flex flex-col gap-1 min-w-[200px] sticky top-0 self-start">
  <div class="px-3 pt-2 pb-1 text-xs font-medium text-surface-600-300 uppercase tracking-wide">
    Workspace
  </div>

  <SwinsNavButton
    component="settingsWorkspacePreferences"
    pop="current"
    title="Workspace · Preferences"
    className="w-full flex gap-2 items-center py-2 px-3 rounded hover:preset-tonal {activeComponentId === 'settings-workspace-preferences' ? 'preset-tonal' : ''}"
  >
    <Settings size={18} />
    <span>Preferences</span>
  </SwinsNavButton>

  <SwinsNavButton
    component="settingsAppearance"
    pop="current"
    title={i18n.texts.settingsPage.appearance.title}
    className="w-full flex gap-2 items-center py-2 px-3 rounded hover:preset-tonal {activeComponentId === 'settings-appearance' ? 'preset-tonal' : ''}"
  >
    <Palette size={18} />
    <span>{i18n.texts.settingsPage.appearance.title}</span>
  </SwinsNavButton>

  <SwinsNavButton
    component="settingsProviders"
    pop="current"
    title={i18n.texts.settingsPage.providers.title}
    className="w-full flex gap-2 items-center py-2 px-3 rounded hover:preset-tonal {activeComponentId === 'settings-providers' ? 'preset-tonal' : ''}"
  >
    <Cpu size={18} />
    <span>{i18n.texts.settingsPage.providers.title}</span>
  </SwinsNavButton>

  <SwinsNavButton
    component="settingsAssistants"
    pop="current"
    title={i18n.texts.basics.apps}
    className="w-full flex gap-2 items-center py-2 px-3 rounded hover:preset-tonal {activeComponentId === 'settings-assistants' ? 'preset-tonal' : ''}"
  >
    <Bot size={18} />
    <span>{i18n.texts.basics.apps}</span>
  </SwinsNavButton>

  <SwinsNavButton
    component="settingsWorkspacePrivacySync"
    pop="current"
    title="Workspace Privacy & Sync"
    className="w-full flex gap-2 items-center py-2 px-3 rounded hover:preset-tonal {activeComponentId === 'settings-workspace-privacy-sync' ? 'preset-tonal' : ''}"
  >
    <Shield size={18} />
    <span>Privacy &amp; Sync</span>
  </SwinsNavButton>

  <div class="px-3 pt-4 pb-1 text-xs font-medium text-surface-600-300 uppercase tracking-wide">
    App
  </div>

  <!--
  <SwinsNavButton
    component="settingsAppPersonalization"
    pop="current"
    title="Personalization"
    className="w-full flex gap-2 items-center py-2 px-3 rounded hover:preset-tonal {activeComponentId === 'settings-app-personalization' ? 'preset-tonal' : ''}"
  >
    <User size={18} />
    <span>Personalization</span>
  </SwinsNavButton>
  -->

  <SwinsNavButton
    component="settingsWorkspaces"
    pop="current"
    title={i18n.texts.settingsPage.spaces.title}
    className="w-full flex gap-2 items-center py-2 px-3 rounded hover:preset-tonal {activeComponentId === 'settings-workspaces' ? 'preset-tonal' : ''}"
  >
    <FolderOpen size={18} />
    <span>{i18n.texts.settingsPage.spaces.title}</span>
  </SwinsNavButton>

  <SwinsNavButton
    component="settingsDev"
    pop="current"
    title={i18n.texts.settingsPage.developers.title}
    className="w-full flex gap-2 items-center py-2 px-3 rounded hover:preset-tonal {activeComponentId === 'settings-dev' ? 'preset-tonal' : ''}"
  >
    <Code size={18} />
    <span>{i18n.texts.settingsPage.developers.title}</span>
  </SwinsNavButton>
</nav>
