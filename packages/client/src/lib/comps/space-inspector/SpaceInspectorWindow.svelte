<script lang="ts">
  import SpaceInspector from "./SpaceInspector.svelte";
  import { onMount } from "svelte";
  import { i18n } from "@sila/client";

  let isDragging = false;
  let isResizing = false;
  let startX: number;
  let startY: number;
  let startLeft: number;
  let startTop: number;
  let startWidth: number;
  let startHeight: number;
  let windowElement: HTMLDivElement;

  function handleDragStart(e: MouseEvent) {
    e.preventDefault();
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = windowElement.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;
  }

  function handleResizeStart(e: MouseEvent) {
    e.preventDefault();
    isResizing = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = windowElement.getBoundingClientRect();
    startWidth = rect.width;
    startHeight = rect.height;
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isDragging && !isResizing) return;
    e.preventDefault();

    if (isDragging) {
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      windowElement.style.left = `${startLeft + deltaX}px`;
      windowElement.style.top = `${startTop + deltaY}px`;
    }

    if (isResizing) {
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      const newWidth = Math.max(300, startWidth + deltaX);
      const newHeight = Math.max(200, startHeight + deltaY);
      windowElement.style.width = `${newWidth}px`;
      windowElement.style.height = `${newHeight}px`;
    }
  }

  function handleMouseUp() {
    isDragging = false;
    isResizing = false;
  }

  onMount(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  });
</script>

<div 
  bind:this={windowElement}
  role="dialog"
  aria-label={i18n.texts.spaceInspector.windowAriaLabel}
  class="fixed z-10 top-20 right-4 bg-surface-50-950 shadow-xl rounded-lg border border-surface-200-800 min-w-[300px] min-h-[200px] flex flex-col"
  style="width: 300px; height: 400px;"
>
  <button 
    class="w-full h-8 cursor-move bg-surface-200-800 rounded-t-lg flex items-center px-4 shrink-0"
    aria-label={i18n.texts.spaceInspector.dragWindowAria}
    on:mousedown={handleDragStart}
  >
    {i18n.texts.spaceInspector.windowTitle}
  </button>
  <div class="p-4 flex-grow overflow-auto">
    <SpaceInspector />
  </div>
  <div 
    class="resize-handle absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
    on:mousedown={handleResizeStart}
    role="button"
    aria-label={i18n.texts.spaceInspector.resizeWindowAria}
    tabindex="0"
  ></div>
</div>

<style>
  .resize-handle {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 16px;
    height: 16px;
    cursor: se-resize;
  }

  .resize-handle::before {
    content: '';
    position: absolute;
    right: 3px;
    bottom: 3px;
    width: 6px;
    height: 6px;
    border-right: 2px solid #666;
    border-bottom: 2px solid #666;
  }
</style>
