<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { Vertex } from "@sila/core";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import ContextMenu from "@sila/client/comps/ui/ContextMenu.svelte";
  import FileOrFolder from "./FileOrFolder.svelte";
  import DragOverlay from "./DragOverlay.svelte";
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
  let dragCandidate: { id: string; startX: number; startY: number } | null =
    $state(null);
  let isDragging = $state(false);
  let mouseX = $state(0);
  let mouseY = $state(0);
  // Marquee selection detection (empty space drag)
  let marqueeCandidate: { startX: number; startY: number } | null =
    $state(null);
  let isMarqueeSelecting = $state(false);
  let marqueeRect: { x: number; y: number; w: number; h: number } | null =
    $state(null);
  let suppressNextEmptyClick = $state(false);

  function rectFromPoints(x1: number, y1: number, x2: number, y2: number) {
    const left = Math.min(x1, y2 === undefined ? x1 : x2);
    const top = Math.min(y1, x2 === undefined ? y1 : y2);
    const right = Math.max(x1, x2);
    const bottom = Math.max(y1, y2);
    return { x: left, y: top, w: right - left, h: bottom - top };
  }

  function intersects(r: { x: number; y: number; w: number; h: number }, el: DOMRect) {
    const r2 = { x: el.left, y: el.top, w: el.width, h: el.height };
    return !(
      r.x + r.w < r2.x ||
      r2.x + r2.w < r.x ||
      r.y + r.h < r2.y ||
      r2.y + r2.h < r.y
    );
  }

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
    const [from, toIdx] =
      startIndex <= endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
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
    // If plain click (no modifiers) and the item isn't selected yet, select it
    // Avoid interfering with Shift/Meta multiselect which is handled on click
    if (!selectedIds.has(v.id) && !event.shiftKey && !(event.metaKey || event.ctrlKey)) {
      selectSingle(v);
    }
    // Record drag candidate
    dragCandidate = { id: v.id, startX: event.clientX, startY: event.clientY };
    window.addEventListener("mousemove", onWindowMouseMove);
    window.addEventListener("mouseup", onWindowMouseUp, { once: true });
  }

  function onWindowMouseMove(e: MouseEvent) {
    if (!dragCandidate && !marqueeCandidate) return;
    if (!isDragging) {
      if (dragCandidate) {
        const dx = Math.abs(e.clientX - dragCandidate.startX);
        const dy = Math.abs(e.clientY - dragCandidate.startY);
        if (dx > 4 || dy > 4) {
          isDragging = true;
        }
      }
    }
    mouseX = e.clientX;
    mouseY = e.clientY;
    // When dragging, detect a potential drop target under the cursor
    if (isDragging) {
      const el = document.elementFromPoint(
        e.clientX,
        e.clientY
      ) as HTMLElement | null;
      const targetEl = el?.closest("[data-vertex-id]") as HTMLElement | null;
      const id = targetEl?.dataset.vertexId ?? null;
      if (id) {
        // Resolve using the tree from the first item when available
        const tree = items[0]?.tree;
        let target =
          items.find((i) => i.id === id) || (tree ? tree.getVertex(id) : null);
        if (target && isFolder(target) && !selectedIds.has(id)) {
          if (dropTargetId !== id) dropTargetId = id;
        } else {
          if (dropTargetId !== null) dropTargetId = null;
        }
      } else if (dropTargetId !== null) {
        dropTargetId = null;
      }
    }

    // Handle marquee activation threshold and live selection
    if (marqueeCandidate && !isMarqueeSelecting) {
      const dx = Math.abs(e.clientX - marqueeCandidate.startX);
      const dy = Math.abs(e.clientY - marqueeCandidate.startY);
      if (dx > 3 || dy > 3) {
        isMarqueeSelecting = true;
      }
    }
    if (isMarqueeSelecting && marqueeCandidate) {
      const r = rectFromPoints(
        marqueeCandidate.startX,
        marqueeCandidate.startY,
        e.clientX,
        e.clientY
      );
      marqueeRect = r;

      const tiles = (containerEl?.querySelectorAll(
        '[data-vertex-id]'
      ) || []) as NodeListOf<HTMLElement>;
      const next = new Set<string>();
      tiles.forEach((el) => {
        const box = el.getBoundingClientRect();
        if (intersects(r, box)) {
          const id = el.dataset.vertexId;
          if (id) next.add(id);
        }
      });
      selectedIds = next;
      // Keep focus on grid for keyboard
      containerEl?.focus();
    }
  }

  function moveVertices(vertices: Vertex[], destination: Vertex) {
    if (vertices.some((v) => v.id === destination.id)) {
      console.error(
        "One of the vertices is the destination folder. Cannot do that"
      );
      return;
    }

    for (const vertex of vertices) {
      vertex.moveTo(destination);
    }
  }

  function onWindowMouseUp(e: MouseEvent) {
    window.removeEventListener("mousemove", onWindowMouseMove);
    if (isDragging) {
      const destinationVertex = dropTargetId
        ? items[0]?.tree.getVertex(dropTargetId)
        : undefined;

      if (destinationVertex) {
        const selectedVertices = items.filter((i) => selectedIds.has(i.id));
        moveVertices(selectedVertices, destinationVertex);
      }
    }
    isDragging = false;
    dragCandidate = null;
    dropTargetId = null;
    mouseX = 0;
    mouseY = 0;
    // Marquee end handling
    if (isMarqueeSelecting) {
      // Prevent the subsequent click on the container from clearing selection
      suppressNextEmptyClick = true;
    }
    isMarqueeSelecting = false;
    marqueeCandidate = null;
    marqueeRect = null;
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
      const fileInfo = await ClientFileResolver.resolveFileReference(
        fileRef,
        clientState
      );
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
      if (suppressNextEmptyClick) {
        suppressNextEmptyClick = false;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
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
      if (e.key === "Escape") {
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
    } else if (key === "Escape") {
      // Clear selection when pressing Esc inside the grid
      if (selectedIds.size > 0) {
        clearSelection();
        e.preventDefault();
        e.stopPropagation();
      }
    } else if (key === "Tab") {
      // Keep focus within grid; don't tab to per-item wrappers
      e.preventDefault();
      e.stopPropagation();
    }
  }

  // Keyboard handling is bound directly on the container element
</script>

<div
  class="flex flex-wrap gap-3 select-none focus:outline-none focus:ring-0 focus-visible:outline-none"
  bind:this={containerEl}
  tabindex="0"
  role="grid"
  aria-label="Files and folders"
  onkeydown={handleKeydown}
  onclick={onEmptyAreaClick}
  onmousedown={(e) => {
    // Start marquee if user clicks empty space (not on item)
    if (e.button !== 0) return;
    if (e.target === containerEl) {
      e.preventDefault();
      marqueeCandidate = { startX: e.clientX, startY: e.clientY };
      window.addEventListener("mousemove", onWindowMouseMove);
      window.addEventListener("mouseup", onWindowMouseUp, { once: true });
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
      data-vertex-id={item.id}
      onkeydown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          // Delegate to container's handler
          handleKeydown(new KeyboardEvent("keydown", { key: "Enter" }));
        }
      }}
    >
      <FileOrFolder
        vertex={item}
        {onEnter}
        selected={isSelected(item)}
        renaming={renamingId === item.id}
        dropTarget={dropTargetId === item.id}
        onRename={(newName) => {
          if (newName && newName.trim()) {
            item.name = newName.trim();
          }
          renamingId = null;
        }}
        onCancelRename={() => {
          renamingId = null;
        }}
      />
    </div>
  {/each}

  <!-- Shared context menu -->
  {#if menuOpen}
    <div class="fixed" style={`left:${menuX}px; top:${menuY}px`}>
      <ContextMenu
        open={menuOpen}
        onOpenChange={(e) => (menuOpen = e.open)}
        placement="bottom"
        triggerClassNames=""
      >
        {#snippet trigger()}
          <!-- invisible trigger element at the requested coordinates -->
          <button type="button" class="w-0 h-0 p-0 m-0" aria-hidden="true"
          ></button>
        {/snippet}
        {#snippet content()}
          <div class="flex flex-col gap-1 w-48">
            <button
              class="btn btn-sm text-left"
              onclick={openSelected}
              disabled={selectedIds.size !== 1}>Open</button
            >
            <button
              class="btn btn-sm text-left"
              onclick={renameSelected}
              disabled={selectedIds.size !== 1}>Rename</button
            >
            <button
              class="btn btn-sm preset-filled-error-500 text-left"
              onclick={deleteSelected}>Delete</button
            >
          </div>
        {/snippet}
      </ContextMenu>
    </div>
  {/if}

  {#if marqueeRect}
    <div
      class="fixed pointer-events-none border border-blue-500/60 bg-blue-500/10 z-[9998]"
      style={`left:${marqueeRect.x}px; top:${marqueeRect.y}px; width:${marqueeRect.w}px; height:${marqueeRect.h}px`}
    ></div>
  {/if}

  {#if isDragging}
    <DragOverlay
      items={items.filter((i) => selectedIds.has(i.id))}
      x={mouseX}
      y={mouseY}
    />
  {/if}
</div>
