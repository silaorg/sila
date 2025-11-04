<script lang="ts">
  import { onMount, onDestroy } from "svelte";
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
    onBack,
  }: {
    items: Vertex[];
    onEnter: (folder: Vertex) => void;
    selectId?: string;
    renameId?: string;
    onBack?: () => void;
  } = $props();

  // Selection state
  let selectedIds = $state<Set<string>>(new Set());
  let focusedId = $state<string | null>(null);
  let containerEl: HTMLDivElement | null = null;
  // Live drop target id (folder under cursor during drag)
  let dropTargetId: string | null = $state(null);
  // Drag detection (for moving selected items later)
  let dragCandidate: { id: string; startX: number; startY: number } | null = $state(null);
  let isDragging = $state(false);
  // Marquee selection detection (empty space drag)
  let marqueeCandidate: { startX: number; startY: number } | null = $state(null);
  let isMarqueeSelecting = $state(false);

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
    // Ensure container receives focus so arrow keys work
    containerEl?.focus();
    // Avoid triggering on right click
    if (event.button === 2) return;

    const isMeta = event.metaKey || event.ctrlKey;
    const isShift = event.shiftKey;
    if (isShift) selectRange(v);
    else if (isMeta) toggleSelection(v);
    else selectSingle(v);
    if (renamingId && !selectedIds.has(renamingId)) renamingId = null;
  }

  function onItemMouseDown(event: MouseEvent, v: Vertex) {
    // Only left button, ignore during rename/menu
    if (event.button !== 0 || menuOpen || renamingId) return;
    // Prevent native selections/drag
    event.preventDefault();
    // Record drag candidate
    dragCandidate = { id: v.id, startX: event.clientX, startY: event.clientY };
    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp, { once: true });
  }

  function onWindowMouseMove(e: MouseEvent) {
    if (!dragCandidate) return;
    if (!isDragging) {
      const dx = Math.abs(e.clientX - dragCandidate.startX);
      const dy = Math.abs(e.clientY - dragCandidate.startY);
      if (dx > 4 || dy > 4) {
        isDragging = true;
        console.log('[FilesSelectionArea] drag-start', Array.from(selectedIds));
      }
    }
    // When dragging, detect a potential drop target under the cursor
    if (isDragging) {
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const tile = el?.closest('[data-file-tile]') as HTMLElement | null;
      const id = tile?.dataset.itemId || null;
      if (id) {
        const target = items.find((i) => i.id === id);
        if (target && isFolder(target) && !selectedIds.has(id)) {
          if (dropTargetId !== id) dropTargetId = id;
        } else {
          if (dropTargetId !== null) dropTargetId = null;
        }
      } else {
        if (dropTargetId !== null) dropTargetId = null;
      }
    }
  }

  function onWindowMouseUp(e: MouseEvent) {
    window.removeEventListener('mousemove', onWindowMouseMove);
    if (isDragging) {
      console.log('[FilesSelectionArea] drag-end', {
        items: Array.from(selectedIds),
        at: { x: e.clientX, y: e.clientY },
        dropTargetId
      });
    }
    isDragging = false;
    dragCandidate = null;
    dropTargetId = null;
    // Marquee end handling
    if (isMarqueeSelecting) {
      console.log('[FilesSelectionArea] marquee-end', { at: { x: e.clientX, y: e.clientY } });
    }
    isMarqueeSelecting = false;
    marqueeCandidate = null;
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
      // Keep focus on the grid for keyboard navigation
      containerEl?.focus();
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

  // --- Keyboard navigation (simple) ---
  function getCurrentIndex(): number {
    if (selectedIds.size === 0) return -1;
    const id = Array.from(selectedIds)[0];
    return items.findIndex((i) => i.id === id);
  }

  function selectIndex(newIndex: number) {
    if (items.length === 0) return;
    const clamped = Math.max(0, Math.min(items.length - 1, newIndex));
    const v = items[clamped];
    selectedIds = new Set([v.id]);
    focusedId = v.id;
    if (renamingId && renamingId !== v.id) renamingId = null;
  }

  function handleKeydown(e: KeyboardEvent) {
    // Ignore when context menu is open or renaming is active
    if (menuOpen || renamingId) {
      if (e.key === 'Escape') {
        if (menuOpen) {
          menuOpen = false;
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (renamingId) {
          renamingId = null;
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }
      return;
    }

    const key = e.key;
    if (key === "Enter") {
      if (selectedIds.size === 0 && items.length > 0) {
        selectIndex(0);
      } else {
        openSelected();
      }
      e.preventDefault();
      e.stopPropagation();
    } else if (key === "F2") {
      if (selectedIds.size === 1) {
        renameSelected();
        e.preventDefault();
        e.stopPropagation();
      }
    } else if (key === "Backspace") {
      // Navigate back (to parent) when not at root
      onBack?.();
      e.preventDefault();
      e.stopPropagation();
    } else if (key === "ArrowLeft" || key === "ArrowUp") {
      const idx = getCurrentIndex();
      if (idx === -1) selectIndex(0);
      else selectIndex(idx - 1);
      e.preventDefault();
      e.stopPropagation();
    } else if (key === "ArrowRight" || key === "ArrowDown") {
      const idx = getCurrentIndex();
      if (idx === -1) selectIndex(0);
      else selectIndex(idx + 1);
      e.preventDefault();
      e.stopPropagation();
    } else if (key === 'Escape') {
      // Clear selection when pressing Esc inside the grid
      if (selectedIds.size > 0) {
        clearSelection();
        e.preventDefault();
        e.stopPropagation();
      }
    } else if (key === 'Tab') {
      // Keep focus within grid; don't tab to per-item wrappers
      e.preventDefault();
      e.stopPropagation();
    }
  }

  onMount(() => {
    // Attach to container for scoping
    containerEl?.addEventListener("keydown", handleKeydown);
    return () => {
      containerEl?.removeEventListener("keydown", handleKeydown);
    };
  });

  onDestroy(() => {
    // handled via onMount return
  });
</script>

<div class="flex flex-wrap gap-3 select-none focus:outline-none focus:ring-0 focus-visible:outline-none" bind:this={containerEl} tabindex="0" role="grid" aria-label="Files and folders"
  onmousedown={(e) => {
    // Start marquee if user clicks empty space (not on item)
    if (e.button !== 0) return;
    if (e.target === containerEl) {
      e.preventDefault();
      marqueeCandidate = { startX: e.clientX, startY: e.clientY };
      window.addEventListener('mousemove', (ev) => {
        if (!marqueeCandidate) return;
        if (!isMarqueeSelecting) {
          const dx = Math.abs(ev.clientX - marqueeCandidate.startX);
          const dy = Math.abs(ev.clientY - marqueeCandidate.startY);
          if (dx > 3 || dy > 3) {
            isMarqueeSelecting = true;
            console.log('[FilesSelectionArea] marquee-start', { at: { x: ev.clientX, y: ev.clientY } });
          }
        }
      }, { once: false });
      window.addEventListener('mouseup', onWindowMouseUp, { once: true });
    }
  }}
>
  {#each items as item (item.id)}
    <div
      oncontextmenu={(e) => onItemContextMenu(e, item)}
      onclick={(e) => onItemClick(e, item)}
      onmousedown={(e) => onItemMouseDown(e, item)}
      class="p-0 m-0 bg-transparent border-0 focus:outline-none focus:ring-0"
      role="gridcell"
      aria-selected={isSelected(item)}
      tabindex="-1"
      data-file-tile
      data-item-id={item.id}
      onkeydown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          // Delegate to container's handler
          handleKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));
        }
      }}
    >
      <FileOrFolder
        vertex={item}
        onEnter={onEnter}
        selected={isSelected(item)}
        renaming={renamingId === item.id}
        dropTarget={dropTargetId === item.id}
        onRename={(newName) => {
          if (newName && newName.trim()) {
            item.name = newName.trim();
          }
          renamingId = null;
        }}
        onCancelRename={() => { renamingId = null; }}
      />
    </div>
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


