<script lang="ts">
  import Lightswitch from "@sila/client/comps/basic/Lightswitch.svelte";
  import ModelProviders from "@sila/client/comps/models/ModelProviders.svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { isDevMode } from "@sila/client/state/devMode";
  const clientState = useClientState();
  import { currentLanguage } from "@sila/client/state/txtStore";
  import {
    SUPPORTED_LANGUAGES,
    LANGUAGE_NAMES,
  } from "@sila/core";
  import { txtStore } from "@sila/client/state/txtStore";
  import ThemeSwitcher from "@sila/client/comps/themes/ThemeSwitcher.svelte";
</script>

<div>
  <!--<h2 class="h2 mb-4">{$txtStore.settingsPage.title}</h2>-->

  <div class="flex flex-col gap-6 w-full">
      <!--
    <div class="card p-4 border-[1px] border-surface-200-800">
      <h3 class="h4 mb-4">{$txtStore.settingsPage.appearance.language}</h3>
      <div class="space-y-4">
        <select bind:value={$currentLanguage} class="select">
          {#each SUPPORTED_LANGUAGES as lang}
            <option value={lang}>{LANGUAGE_NAMES[lang]}</option>
          {/each}
        </select>
      </div>
    </div>
    -->

    <div class="card p-4 border-[1px] border-surface-200-800">
      <h3 class="h4 mb-4">{$txtStore.settingsPage.appearance.title}</h3>
      <div class="space-y-4">
        <label class="label">
          <span>Color scheme</span>
          <Lightswitch />
        </label>

        <label class="label">
          <span>Theme</span>
          <ThemeSwitcher />
        </label>
      </div>
    </div>

    <div class="card p-4 border-[1px] border-surface-200-800">
      <h3 class="h4 mb-4">{$txtStore.settingsPage.providers.title}</h3>
      <ModelProviders />
    </div>

    <div class="card p-4 border-[1px] border-surface-200-800">
      <h3 class="h4 mb-4">Import from ChatGPT</h3>
      <div class="flex items-center gap-3">
        <button class="btn preset-filled" onclick={async () => {
            try {
              const filePath = await (window as any).electronDialog?.openDialog({ title: 'Select ChatGPT export', filters: [{ name: 'Zip', extensions: ['zip'] }] });
              if (!filePath) return;
              const unsubs: Array<() => void> = [];
              const api = (window as any).chatgptImport;
              let created = 0; let skipped = 0;
              unsubs.push(api.onConversation(async (conv: any) => {
                if (!clientState.currentSpace) return;
                // Import each conversation as it arrives
                // Reuse the same logic from browser path, but for a single conversation
                // Minimal duplicate check:
                // Build a fake ExportData wrapper to reuse function quickly
                // For performance, you may want a dedicated function later
                // Here we just rely on the root logic for now
                const res = await (async () => {
                  // Quick path: if duplicate, skip; else create
                  const space = clientState.currentSpace!;
                  // Inline minimal add (avoid re-parsing):
                  // Create chat and messages directly
                  const { ChatAppData } = await import('@sila/core');
                  const existing = (space as any).findObjectWithPropertyAtPath?.('app-forest', 'chatgptId', conv.id);
                  if (existing) { skipped++; return; }
                  const appTree = ChatAppData.createNewChatTree(space, 'default');
                  const chatData = new ChatAppData(space, appTree);
                  chatData.title = conv.title || 'Imported chat';
                  appTree.tree.root!.setProperty('chatgptId', conv.id);
                  const ref = space.getVertexReferencingAppTree(appTree.getId());
                  if (ref) ref.setProperty('chatgptId', conv.id);
                  for (const m of conv.messages || []) {
                    const role = m.role === 'assistant' ? 'assistant' : 'user';
                    await chatData.newMessage(role, m.text || '');
                  }
                  created++;
                })();
              }));
              unsubs.push(api.onDone((_summary: any) => {
                unsubs.forEach(u => u());
                alert(`Imported: ${created}, Skipped: ${skipped}`);
              }));
              unsubs.push(api.onError((err: any) => {
                console.error('ChatGPT import error:', err);
                unsubs.forEach(u => u());
                alert('Failed to import ChatGPT export.');
              }));
              await api.parseFromPath(filePath);
            } catch (err) {
              console.error(err);
              alert('Failed to import ChatGPT export.');
            }
          }}>Select ZIP…</button>
        
      </div>
      <p class="text-sm mt-2 opacity-70">Select your ChatGPT export .zip. We will create conversations and attachments. Duplicates are skipped using ChatGPT conversation id.</p>
    </div>

    <div class="card p-4 border-[1px] border-surface-200-800">
      <h3 class="h4 mb-4">{$txtStore.settingsPage.spaces.title}</h3>
      <p class="mb-4">
        {$txtStore.settingsPage.spaces.spaceCount(
          clientState.pointers.length
        )}
      </p>
      <button class="btn preset-filled" onclick={() => clientState.layout.openSpaces()}>
        {$txtStore.settingsPage.spaces.manageButton}
      </button>
    </div>

    <div class="card p-4 border-[1px] border-surface-200-800">
      <h3 class="h4 mb-4">{$txtStore.settingsPage.developers.title}</h3>
      <button
        class="btn preset-filled"
        onclick={() => ($isDevMode = !$isDevMode)}
        >{$txtStore.settingsPage.developers.toggleDevMode}</button
      >
    </div>
  </div>
</div>
