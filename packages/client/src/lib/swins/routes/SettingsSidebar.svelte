<script lang="ts">
  import SwinsNavButton from "../SwinsNavButton.svelte";
  import { Cpu, Bot, FolderOpen, Code, Settings } from "lucide-svelte";
  import { i18n } from "@sila/client";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { isDevMode } from "@sila/client/state/devMode";
  
  const clientState = useClientState();
  const swins = $derived(clientState.layout.swins);
  
  // Automatically detect active category from current window
  let activeCategory = $derived.by(() => {
    if (swins.windows.length === 0) return undefined;
    const currentWindow = swins.windows[swins.windows.length - 1];
    const componentId = currentWindow.componentId;
    
    if (componentId === 'settings-appearance') return 'appearance';
    if (componentId === 'settings-providers') return 'providers';
    if (componentId === 'settings-assistants') return 'assistants';
    if (componentId === 'settings-workspaces') return 'workspaces';
    if (componentId === 'settings-dev') return 'dev';
    if (componentId === 'settings') return 'settings'
    
    return undefined;
  });
</script>

<nav class="flex flex-col gap-1 min-w-[200px] sticky top-0 self-start">
  <SwinsNavButton
    component="settings"
    pop="current"
    title="Workspace Settings"
    className="w-full flex gap-2 items-center py-2 px-3 rounded hover:preset-tonal {activeCategory === 'settings' ? 'preset-tonal' : ''}"
  >
    <Settings size={18} />
    <span>{i18n.texts.settingsPage.title}</span>
  </SwinsNavButton>

  <SwinsNavButton
    component="settingsProviders"
    pop="current"
    title="Model Providers"
    className="w-full flex gap-2 items-center py-2 px-3 rounded hover:preset-tonal {activeCategory === 'providers' ? 'preset-tonal' : ''}"
  >
    <Cpu size={18} />
    <span>{i18n.texts.settingsPage.providers.title}</span>
  </SwinsNavButton>

  <SwinsNavButton
    component="settingsAssistants"
    pop="current"
    title="Assistants"
    className="w-full flex gap-2 items-center py-2 px-3 rounded hover:preset-tonal {activeCategory === 'assistants' ? 'preset-tonal' : ''}"
  >
    <Bot size={18} />
    <span>Assistants</span>
  </SwinsNavButton>

  <SwinsNavButton
    component="settingsWorkspaces"
    pop="current"
    title="Workspaces"
    className="w-full flex gap-2 items-center py-2 px-3 rounded hover:preset-tonal {activeCategory === 'workspaces' ? 'preset-tonal' : ''}"
  >
    <FolderOpen size={18} />
    <span>{i18n.texts.settingsPage.spaces.title}</span>
  </SwinsNavButton>

  <SwinsNavButton
    component="settingsDev"
    pop="current"
    title="For Developers"
    className="w-full flex gap-2 items-center py-2 px-3 rounded hover:preset-tonal {activeCategory === 'dev' ? 'preset-tonal' : ''}"
  >
    <Code size={18} />
    <span>{i18n.texts.settingsPage.developers.title}</span>
  </SwinsNavButton>

</nav>
