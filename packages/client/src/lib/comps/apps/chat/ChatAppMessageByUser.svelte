<script lang="ts">
  import type { FileReference, ThreadMessage } from "@sila/core";
  import type { ChatAppData } from "@sila/core";
  import { onMount } from "svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  const clientState = useClientState();
  import ChatAppMessageControls from "./ChatAppMessageControls.svelte";
  import ChatAppMessageEditForm from "./ChatAppMessageEditForm.svelte";
  import FilePreview from "../../files/FilePreview.svelte";
  import type { VisibleMessage } from "./chatTypes";

  let {
    visibleMessage,
    data,
  }: { visibleMessage: VisibleMessage; data: ChatAppData } = $props();

  const vertex = $derived(visibleMessage.vertex);

  let message: ThreadMessage | undefined = $state(undefined);
  let configName = $state<string | undefined>(undefined);
  let isProcessMessagesExpanded = $state(false);
  let fileRefs = $derived(
    ((message as any)?.files as Array<FileReference>) || []
  );
  let isEditing = $state(false);
  let editText = $state("");

  let hoverDepth = $state(0);
  let showEditAndCopyControls = $state(false);
  let hideControlsTimeout: ReturnType<typeof setTimeout> | null = null;

  function getModelDisplayForMessage(): {
    provider: string;
    model: string;
  } | null {
    // Only use values stored on the message. If not available, return null (do not show anything)
    const provider =
      (message as any)?.modelProviderFinal ||
      (message as any)?.modelProvider ||
      null;
    const model =
      (message as any)?.modelIdFinal || (message as any)?.modelId || null;
    if (provider && model) return { provider, model };
    return null;
  }

  let modelInfo = $derived.by(() => getModelDisplayForMessage());

  async function copyMessage() {
    await navigator.clipboard.writeText(message?.text || "");
  }

  function beginHover() {
    hoverDepth += 1;
    if (hideControlsTimeout) {
      clearTimeout(hideControlsTimeout);
      hideControlsTimeout = null;
    }
    showEditAndCopyControls = true;
  }

  function endHover() {
    hoverDepth = Math.max(0, hoverDepth - 1);
    if (hoverDepth === 0) {
      hideControlsTimeout = setTimeout(() => {
        if (hoverDepth === 0) {
          showEditAndCopyControls = false;
        }
      }, 250);
    }
  }

  function forceKeepControls(open: boolean) {
    if (open) {
      // Popover opened – ensure controls remain visible
      beginHover();
    } else {
      // Popover closed – decrement and maybe hide
      endHover();
    }
  }
  // Branch navigation: use siblings under the same parent
  let branchIndex = $derived.by(() => {
    const parent = vertex?.parent;
    if (!parent || !vertex) return 0;
    const siblings = parent.children;
    const idx = siblings.findIndex((s) => s.id === vertex.id);
    return idx >= 0 ? idx : 0;
  });

  // Update local message when vertex changes
  $effect(() => {
    if (vertex) {
      message = vertex.getAsTypedObject<ThreadMessage>();
    } else {
      message = undefined;
    }
  });

  $effect(() => {
    if (!isEditing) {
      editText = message?.text || "";
    }
  });

  onMount(() => {
    if (!vertex) return;
    const unobserve = data.observeMessage(vertex.id, (msg) => {
      message = msg;
    });

    return () => {
      unobserve();
    };
  });

  function replaceNewlinesWithHtmlBrs(text: string): string {
    // Trim newlines at the start and end
    text = text.replace(/^\n+|\n+$/g, "");
    // Replace remaining newlines with <br />
    return text.replace(/\n/g, "<br />");
  }

  // Branch switching: use vertex.children and data.switchMain
  function prevBranch() {
    const parent = vertex?.parent;
    if (!vertex || !parent || branchIndex <= 0) return;
    const siblings = parent.children;
    data.switchMain(siblings[branchIndex - 1].id);
  }

  function nextBranch() {
    const parent = vertex?.parent;
    if (!vertex || !parent) return;
    const siblings = parent.children;
    if (branchIndex >= siblings.length - 1) return;
    data.switchMain(siblings[branchIndex + 1].id);
  }
</script>

<div class="flex gap-3 px-4 py-2 justify-end">
  <div class="min-w-0 max-w-[85%] ml-auto" class:w-full={isEditing}>
    <div>
      {#if isEditing}
        <div class="block w-full">
          <ChatAppMessageEditForm
            initialValue={editText}
            onSave={(text) => {
              if (vertex) data.editMessage(vertex.id, text);
              isEditing = false;
            }}
            onCancel={() => (isEditing = false)}
          />
        </div>
      {:else}
        <div
          class="relative p-3 rounded-lg bg-surface-100-900/50"
          role="region"
          onpointerenter={beginHover}
          onpointerleave={endHover}
        >
          {#if fileRefs && fileRefs.length > 0}
            <div class="mb-4 flex flex-wrap gap-2">
              {#each fileRefs as att}
                <FilePreview
                  fileRef={att}
                  showGallery={true}
                  onGalleryOpen={(fileInfo) => {
                    clientState.gallery.open(fileInfo);
                  }}
                />
              {/each}
            </div>
          {/if}
          {@html replaceNewlinesWithHtmlBrs(message?.text || "")}
        </div>

        <div
          class="mt-1 h-6 flex items-center justify-end"
          role="presentation"
          onpointerenter={beginHover}
          onpointerleave={endHover}
        >
          <div
            class:invisible={!showEditAndCopyControls}
            class:pointer-events-none={!showEditAndCopyControls}
          >
            <ChatAppMessageControls
              {showEditAndCopyControls}
              onCopyMessage={() => copyMessage()}
              onEditMessage={() => (isEditing = true)}
              {prevBranch}
              {nextBranch}
              {branchIndex}
              branchesNumber={vertex?.parent?.children.length || 0}
            />
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
