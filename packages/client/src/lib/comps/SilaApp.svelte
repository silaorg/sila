<script lang="ts">
  import { onDestroy } from "svelte";
  import { type ClientStateConfig } from "@sila/client";
  import ClientStateProvider from "@sila/client/state/ClientStateProvider.svelte";
  import { ClientState } from "@sila/client";
  import SpaceEntry from "./SpaceEntry.svelte";
  import SwinsContainer from "../swins/SwinsContainer.svelte";
  import ContextMenuHandler from "./ContextMenuHandler.svelte";
  import ThemeManager from "./themes/ThemeManager.svelte";
  import FileGalleryModal from "./files/FileGalleryModal.svelte";

  // Styles are included by host apps as needed in dev/build

  let { config, state }: { config: ClientStateConfig | null, state?: ClientState } = $props();

  const providedState = state || new ClientState();
  $effect(() => {
    if (config) {
      providedState.init(config);
    }
  });

  onDestroy(() => {
    providedState.cleanup();
  });

  console.log(
    "👋 Hey, if you see any bugs - please report them to https://github.com/silaorg/sila/issues",
  );
  console.log(
    "Reach out to the author of the project with any questions - Dmitry at d@dkury.com",
  );
</script>

<ThemeManager />

{#if config}
  <ClientStateProvider instance={providedState}>
    <!-- Where our spaces are rendered -->
    <SpaceEntry />

    <!-- Setup stacking windows (popover windows with navigation) we use for new conversations, settings, etc -->
    <SwinsContainer swins={providedState.layout.swins} />

    <!-- Handle native and custom context menus -->
    <ContextMenuHandler />

    <!-- File Gallery Modal -->
    <FileGalleryModal />
  </ClientStateProvider>
{:else}
  Loading...
{/if}
