<script lang="ts">
  import type { Vertex } from "@sila/core";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import ContextMenu from "@sila/client/comps/ui/ContextMenu.svelte";
  import FileOrFolder from "./FileOrFolder.svelte";
  import { ClientFileResolver } from "../../../utils/fileResolver";

  const clientState = useClientState();

  let {
    items,
    onEnter,
    selectId,
    renameId,
  }: {
    items: Vertex[];
    onEnter: (folder: Vertex) => void;
    selectId?: string;
    renameId?: string;
  } = $props();

  // Selection state
  let selectedIds = $state<Set<string>>(new Set());
  let focusedId = $state<string | null>(null);

  function isSelected(v: Vertex): boolean {
    return selectedIds.has(v.id);
  }

  function clearSelection() {
    selectedIds = new Set();
    focusedId = null;
  }

  function selectSingle(v: Vertex) {
    selectedIds = new Set([v.id]);
    focusedId = v.id;
  }

  function toggleSelection(v: Vertex) {
    const next = new Set(selectedIds);
    if (next.has(v.id)) next.delete(v.id);
    else next.add(v.id);
    selectedIds = next;
    focusedId = v.id;
    if (renamingId && !selectedIds.has(renamingId)) renamingId = null;
  }

  function selectRange(to: Vertex) {
    if (!focusedId) {
      selectSingle(to);
      return;
    }
    const startIndex = items.findIndex((i) => i.id === focusedId);
    const endIndex = items.findIndex((i) => i.id === to.id);
    if (startIndex === -1 || endIndex === -1) {
      selectSingle(to);
      return;
    }
    const [from, toIdx] = startIndex <= endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
    const range = items.slice(from, toIdx + 1).map((i) => i.id);
    selectedIds = new Set(range);
    if (renamingId && !selectedIds.has(renamingId)) renamingId = null;
  }

  function onItemClick(event: MouseEvent, v: Vertex) {
    // Avoid triggering on right click
    if (event.button === 2) return;

    const isMeta = event.metaKey || event.ctrlKey;
    const isShift = event.shiftKey;
    if (isShift) selectRange(v);
    else if (isMeta) toggleSelection(v);
    else selectSingle(v);
    if (renamingId && !selectedIds.has(renamingId)) renamingId = null;
  }

  // Context menu (shared)
  let menuOpen = $state(false);
  let menuX = $state(0);
  let menuY = $state(0);
  let menuTarget: Vertex | null = null;
  let renamingId: string | null = $state(null);

  function onItemContextMenu(event: MouseEvent, v: Vertex) {
    event.preventDefault();
    if (!selectedIds.has(v.id)) {
      selectSingle(v);
    }
    menuTarget = v;
    menuX = event.clientX;
    menuY = event.clientY;
    menuOpen = true;
  }

  function isFolder(v: Vertex): boolean {
    return v.getProperty("mimeType") === undefined;
  }

  async function openSelected() {
    if (selectedIds.size !== 1) return;
    const id = Array.from(selectedIds)[0];
    const v = items.find((i) => i.id === id);
    if (!v) return;
    if (isFolder(v)) onEnter(v);
    else {
      const fileRef = { tree: v.root.id, vertex: v.id } as any;
      const fileInfo = await ClientFileResolver.resolveFileReference(fileRef, clientState);
      if (fileInfo) clientState.gallery.open(fileInfo);
    }
    menuOpen = false;
  }

  function renameSelected() {
    if (selectedIds.size !== 1) return;
    renamingId = Array.from(selectedIds)[0];
    menuOpen = false;
  }

  function deleteSelected() {
    for (const id of selectedIds) {
      const v = items.find((i) => i.id === id);
      v?.delete();
    }
    clearSelection();
    menuOpen = false;
  }

  // Close selection on empty area click
  function onEmptyAreaClick(e: MouseEvent) {
    if (e.target instanceof Element && e.currentTarget === e.target) {
      clearSelection();
    }
  }

  // Apply externally requested selection/rename when props change
  $effect(() => {
    if (selectId) {
      selectedIds = new Set([selectId]);
      focusedId = selectId;
    }
    if (renameId) {
      renamingId = renameId;
    }
  });
</script>

<div class="flex flex-wrap gap-3">
  {#each items as item (item.id)}
    <button
      type="button"
      oncontextmenu={(e) => onItemContextMenu(e, item)}
      onclick={(e) => onItemClick(e, item)}
      class="p-0 m-0 bg-transparent border-0"
    >
      <FileOrFolder
        vertex={item}
        onEnter={onEnter}
        selected={isSelected(item)}
        renaming={renamingId === item.id}
        onRename={(newName) => {
          if (newName && newName.trim()) {
            item.name = newName.trim();
          }
          renamingId = null;
        }}
        onCancelRename={() => { renamingId = null; }}
      />
    </button>
  {/each}

  <!-- Shared context menu -->
  {#if menuOpen}
    <div
      class="fixed"
      style={`left:${menuX}px; top:${menuY}px`}
    >
      <ContextMenu
        open={menuOpen}
        onOpenChange={(e) => (menuOpen = e.open)}
        placement="bottom"
        triggerClassNames=""
      >
        {#snippet trigger()}
          <!-- invisible trigger element at the requested coordinates -->
          <button type="button" class="w-0 h-0 p-0 m-0" aria-hidden="true"></button>
        {/snippet}
        {#snippet content()}
          <div class="flex flex-col gap-1 w-48">
            <button class="btn btn-sm text-left" onclick={openSelected} disabled={selectedIds.size !== 1}>Open</button>
            <button class="btn btn-sm text-left" onclick={renameSelected} disabled={selectedIds.size !== 1}>Rename</button>
            <button class="btn btn-sm preset-filled-error-500 text-left" onclick={deleteSelected}>Delete</button>
          </div>
        {/snippet}
      </ContextMenu>
    </div>
  {/if}
</div>


