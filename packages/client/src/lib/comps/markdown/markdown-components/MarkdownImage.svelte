<script lang="ts">
  import type { Tokens } from "@markpage/svelte";
  import { useChatAppDataOptional } from "../../apps/chat/chatAppContext";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import type { ResolvedFileInfo, Vertex } from "@sila/core";

  let { token } = $props<{
    token: Tokens.Image;
  }>();

  const chatAppData = useChatAppDataOptional();
  const clientState = useClientState();
  const filesVertex = $derived(chatAppData?.getFilesRoot(false));
  const fileResolver = $derived(clientState.currentSpaceState?.fileResolver);
  const isFile = $derived(token.href?.startsWith("file:") ?? false);

  const resolvedFile: ResolvedFileInfo | null = $derived.by(() => {
    if (!isFile || !fileResolver || !token.href) {
      return null;
    }

    try {
      const vertex = fileResolver.pathToVertex(token.href, filesVertex ?? undefined);
      return fileResolver.resolveVertexToFileReference(vertex);
    } catch (error) {
      console.error("Failed to resolve file URL for image:", token.href, error);
      return null;
    }
  });

  const fileVertex: Vertex | null = $derived.by(() => {
    if (!isFile || !fileResolver || !token.href) {
      return null;
    }

    try {
      return fileResolver.pathToVertex(token.href, filesVertex ?? undefined);
    } catch (error) {
      return null;
    }
  });

  function openImage() {
    if (!fileVertex || !clientState.currentSpaceState?.vertexViewer) {
      return;
    }

    clientState.currentSpaceState.vertexViewer.openVertex(fileVertex);
  }
</script>

{#if isFile}
  {#if resolvedFile}
    <button
      class="markdown-image-button cursor-pointer border-none bg-transparent p-0 inline-block"
      onclick={openImage}
      type="button"
      aria-label={`Open image: ${token.text || resolvedFile.name || ""}`}
    >
      <img
        src={resolvedFile.url}
        alt={token.text || resolvedFile.name || ""}
        title={token.title || resolvedFile.name || undefined}
        class="markdown-image"
      />
    </button>
  {:else}
    <!-- Failed to resolve file -->
    <div class="markdown-image text-sm text-gray-500 italic">
      Failed to load image: {token.href}
    </div>
  {/if}
{:else}
  <img src={token.href} alt={token.text || ""} title={token.title || undefined} class="markdown-image" />
{/if}

<style>
  .markdown-image {
    max-width: 100%;
    max-width: min(100%, 600px);
    height: auto;
    object-fit: contain;
  }

  .markdown-image-button {
    display: inline-block;
  }
</style>
