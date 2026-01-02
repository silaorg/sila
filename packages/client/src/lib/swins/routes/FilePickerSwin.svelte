<script lang="ts">
  import FilesApp from "@sila/client/comps/apps/files/FilesApp.svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import type { Vertex } from "@sila/core";
  import { i18n } from "@sila/client";

  const clientState = useClientState();

  let { onPick }: { onPick: (files: Vertex[]) => void } = $props();

  let filesRoot = $derived.by(() => {
    if (!clientState.currentSpace) return undefined;
    return clientState.currentSpace.getVertexByPath("assets");
  });

  let selectedFiles = $state<Vertex[]>([]);

  // Allow both files and folders to be attached
  let attachableItems = $derived(selectedFiles);

  function handleAttach() {
    if (attachableItems.length === 0) return;
    onPick?.(attachableItems);
    clientState.layout.swins.pop();
  }
</script>

<div class="flex flex-col gap-3">
  {#if filesRoot}
    <FilesApp
      filesRoot={filesRoot}
      onSelectionChange={(files) => {
        selectedFiles = files;
      }}
    />
  {:else}
    <p class="text-sm text-surface-600-300">
      {i18n.texts.filePicker.workspaceFilesUnavailable}
    </p>
  {/if}

  <div class="flex items-center justify-end gap-2">
    <button class="btn btn-lg" type="button" onclick={() => clientState.layout.swins.pop()}>
      {i18n.texts.actions.cancel}
    </button>
    <button
      class="btn btn-lg preset-filled-primary-500"
      type="button"
      onclick={handleAttach}
      disabled={attachableItems.length === 0}
    >
      {i18n.texts.actions.attach}
    </button>
  </div>
</div>
