<script lang="ts">
  import { useClientState } from "@sila/client/state/clientStateContext";
  const clientState = useClientState();
  import type { AppConfig } from "@sila/core";
  import { Images, SquarePen } from "lucide-svelte";
  import SwinsNavButton from "@sila/client/swins/SwinsNavButton.svelte";
  import { txtStore } from "@sila/client/state/txtStore.ts";
  import { untrack } from "svelte";

  let appConfigs = $state<AppConfig[]>([]);
  let appConfigUnobserve: (() => void) | undefined;

  $effect(() => {
    const space = clientState.currentSpace;
    if (!space) {
      return;
    }

    // Untrack "appConfigs" state updates
    untrack(() => {
      appConfigUnobserve = space.appConfigs.observe((configs: AppConfig[]) => {
        appConfigs = configs;
      });
    });

    return () => {
      appConfigUnobserve?.();
    };
  });
</script>

<ul class="space-y-1">
  {#each appConfigs as config (config.id)}
    {#if config.visible}
      <li>
        <SwinsNavButton
          component="newThread"
          title="New conversation"
          props={{ appConfig: config }}
          className="w-full flex gap-2 flex-grow py-1 px-1 truncate flex rounded hover:preset-tonal"
          dataRole="sidebar-assistant-button"
        >
          <span class="flex-shrink-0 w-6 h-6">
            <span class="relative flex h-full items-center justify-center">
              <SquarePen size={18} />
            </span>
          </span>
          <span class="flex-grow text-left ph-no-capture">{config.name}</span>
        </SwinsNavButton>
      </li>
    {/if}
  {/each}
  <li>
    <SwinsNavButton
    component="files"
    title="Workspace Assets"
    className="w-full flex gap-2 flex-grow py-1 px-1 truncate flex rounded hover:preset-tonal"
  >
    <span class="w-6 h-6 flex-shrink-0">
      <span class="relative flex h-full items-center justify-center">
        <Images size={18} />
      </span>
    </span>
    <span class="flex-grow text-left">Assets</span>
  </SwinsNavButton>
  </li>
</ul>
