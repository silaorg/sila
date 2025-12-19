<script lang="ts">
  import type { Tokens } from "@markpage/svelte";
  import { useChatAppDataOptional } from "../../apps/chat/chatAppContext";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { parseFrefUri, type ResolvedFileInfo, Vertex } from "@sila/core";
  import MarkdownTextDocument from "./MarkdownTextDocument.svelte";

  let { token }: { token: Tokens.Image } = $props();

  const chatAppData = useChatAppDataOptional();
  const clientState = useClientState();
  const filesVertex = $derived(chatAppData?.getFilesRoot(false));
  const fileResolver = $derived(clientState.currentSpaceState?.fileResolver);
  const isFile = $derived((token.href?.startsWith("file:") || token.href?.startsWith("fref:")) ?? false);

  let resolvedFile = $state<ResolvedFileInfo | null>(null);
  let fileVertex = $state<Vertex | null>(null);

  $effect(() => {
    resolvedFile = null;
    fileVertex = null;

    if (!isFile || !fileResolver || !token.href) return;

    let cancelled = false;
    const href = token.href;
    const space = clientState.currentSpace;

    (async () => {
      try {
        let vertex: Vertex | null = null;
        if (href.startsWith("file:")) {
          vertex = fileResolver.pathToVertex(href, filesVertex ?? undefined) as Vertex;
        } else if (href.startsWith("fref:")) {
          if (!space) return;
          const parsed = parseFrefUri(href);
          if (!parsed) return;
          if (parsed.treeId) {
            if (parsed.treeId === space.getId()) {
              vertex = (space.getVertex(parsed.vertexId) as Vertex | undefined) ?? null;
            } else {
              const appTree = await space.loadAppTree(parsed.treeId);
              vertex = (appTree?.tree.getVertex(parsed.vertexId) as Vertex | undefined) ?? null;
            }
          } else {
            // Best-effort: try workspace first, then loaded app trees.
            vertex = (space.getVertex(parsed.vertexId) as Vertex | undefined) ?? null;
            if (!vertex) {
              for (const tid of space.getAppTreeIds()) {
                const appTree = await space.loadAppTree(tid);
                const v = (appTree?.tree.getVertex(parsed.vertexId) as Vertex | undefined) ?? null;
                if (v) {
                  vertex = v;
                  break;
                }
              }
            }
          }
        }

        if (!vertex) return;
        const info = fileResolver.resolveVertexToFileReference(vertex);
        if (cancelled) return;
        fileVertex = vertex;
        resolvedFile = info;
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to resolve image file reference:", token.href, error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  });

  const isVideo = $derived(
    resolvedFile?.mimeType?.startsWith("video/") ?? false
  );

  const isTextDocument = $derived(
    resolvedFile?.mimeType?.startsWith("text/") ?? false
  );

  function openFile() {
    if (!fileVertex || !clientState.currentSpaceState?.vertexViewer) {
      return;
    }

    clientState.currentSpaceState.vertexViewer.openVertex(fileVertex);
  }
</script>

{#if isFile}
  {#if resolvedFile}
    {#if isTextDocument && resolvedFile}
      <MarkdownTextDocument
        {resolvedFile}
        {fileVertex}
        fileName={token.text || resolvedFile.name || ""}
      />
    {:else if isVideo}
      <button
        class="markdown-video-button cursor-pointer border-none bg-transparent p-0 inline-block"
        onclick={openFile}
        type="button"
        aria-label={`Open video: ${token.text || resolvedFile.name || ""}`}
      >
        <video
          src={resolvedFile.url}
          controls
          class="markdown-video"
          preload="metadata"
        >
          <track kind="captions" />
        </video>
      </button>
    {:else}
      <button
        class="markdown-image-button cursor-pointer border-none bg-transparent p-0 inline-block"
        onclick={openFile}
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
    {/if}
  {:else}
    <!-- Failed to resolve file -->
    <div class="markdown-image text-sm text-gray-500 italic">
      Failed to load file: {token.href}
    </div>
  {/if}
{:else}
  <img src={token.href} alt={token.text || ""} title={token.title || undefined} class="markdown-image" />
{/if}

<style>
  .markdown-image {
    max-width: 100%;
    max-width: min(100%, 500px);
    height: auto;
    object-fit: contain;
  }

  .markdown-video {
    max-width: 100%;
    max-width: min(100%, 600px);
    height: auto;
  }

  .markdown-image-button,
  .markdown-video-button {
    display: inline-block;
  }
</style>
