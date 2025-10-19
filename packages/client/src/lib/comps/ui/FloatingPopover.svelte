<script lang="ts">
  import type { Snippet } from "svelte";
  import { onMount, onDestroy } from "svelte";
  import { computePosition, offset as fuiOffset, flip, shift, autoUpdate, type Placement } from "@floating-ui/dom";

  let {
    placement = "right" as Placement,
    offset = 8,
    openDelay = 250,
    closeDelay = 150,
    interactive = true,
    zIndex = 1000,
    contentClass = "card bg-surface-50-950 border border-surface-100-900 p-3 shadow-lg min-w-[260px]",
    trigger,
    content,
    onContentEnter = undefined as undefined | (() => void),
    onContentLeave = undefined as undefined | (() => void),
    onTriggerEnter = undefined as undefined | (() => void),
    onTriggerLeave = undefined as undefined | (() => void),
    onOpenChange = undefined as undefined | ((open: boolean) => void),
  }: {
    placement?: Placement;
    offset?: number;
    openDelay?: number;
    closeDelay?: number;
    interactive?: boolean;
    zIndex?: number;
    contentClass?: string;
    trigger: Snippet<[]>;
    content: Snippet<[]>;
    onContentEnter?: () => void;
    onContentLeave?: () => void;
    onTriggerEnter?: () => void;
    onTriggerLeave?: () => void;
    onOpenChange?: (open: boolean) => void;
  } = $props();

  let isOpen = $state(false);
  let triggerEl: HTMLElement | null = null;
  let contentEl: HTMLDivElement | null = null;
  let cleanupAutoUpdate: (() => void) | null = null;
  let openTimeout: ReturnType<typeof setTimeout> | null = null;
  let closeTimeout: ReturnType<typeof setTimeout> | null = null;

  function clearTimers() {
    if (openTimeout) { clearTimeout(openTimeout); openTimeout = null; }
    if (closeTimeout) { clearTimeout(closeTimeout); closeTimeout = null; }
  }

  function scheduleOpen() {
    clearTimers();
    openTimeout = setTimeout(() => open(), openDelay);
  }

  function scheduleClose() {
    clearTimers();
    closeTimeout = setTimeout(() => close(), closeDelay);
  }

  function open() {
    if (!triggerEl || !contentEl) return;
    isOpen = true;
    attachToBody();
    startAutoUpdate();
    updatePosition();
    onOpenChange?.(true);
  }

  function close() {
    isOpen = false;
    stopAutoUpdate();
    // keep contentEl in body but hide it; this avoids re-creation flicker
    if (contentEl) {
      contentEl.style.display = "none";
    }
    onOpenChange?.(false);
  }

  function attachToBody() {
    if (!contentEl) return;
    if (contentEl.parentElement !== document.body) {
      document.body.appendChild(contentEl);
    }
    // Ensure visible when open
    contentEl.style.display = "block";
    contentEl.style.position = "fixed";
    contentEl.style.zIndex = String(zIndex);
  }

  function startAutoUpdate() {
    if (!triggerEl || !contentEl) return;
    cleanupAutoUpdate?.();
    cleanupAutoUpdate = autoUpdate(triggerEl, contentEl, updatePosition);
  }

  function stopAutoUpdate() {
    cleanupAutoUpdate?.();
    cleanupAutoUpdate = null;
  }

  async function updatePosition() {
    if (!triggerEl || !contentEl) return;
    const { x, y } = await computePosition(triggerEl, contentEl, {
      placement,
      middleware: [fuiOffset(offset), flip(), shift({ padding: 8 })],
    });
    Object.assign(contentEl.style, {
      left: `${x}px`,
      top: `${y}px`,
    });
  }

  function onTriggerMouseEnter() {
    scheduleOpen();
    onTriggerEnter?.();
  }

  function onTriggerMouseLeave() {
    if (interactive && isOpen) return scheduleClose();
    scheduleClose();
    onTriggerLeave?.();
  }

  function onContentMouseEnter() {
    if (!interactive) return;
    clearTimers();
    onContentEnter?.();
  }

  function onContentMouseLeave() {
    if (!interactive) return;
    scheduleClose();
    onContentLeave?.();
  }

  onMount(() => {
    return () => {
      clearTimers();
      stopAutoUpdate();
      // remove content element if still attached
      if (contentEl && contentEl.parentElement === document.body) {
        try { document.body.removeChild(contentEl); } catch {}
      }
    };
  });
</script>

<div
  onmouseenter={onTriggerMouseEnter}
  onmouseleave={onTriggerMouseLeave}
  data-popover-trigger
  role="presentation"
>
  <span bind:this={triggerEl} class="inline-flex items-center">{@render trigger?.()}</span>
</div>

<!-- Popover content rendered in body via direct DOM attachment -->
<div
  bind:this={contentEl}
  class={contentClass}
  style="display: none;"
  role="tooltip"
  onmouseenter={onContentMouseEnter}
  onmouseleave={onContentMouseLeave}
>
  {@render content?.()}
</div>

<style>
  /* Ensure the content card ignores layout of original component and floats */
  :global(.floating-popover-hidden) { display: none; }
</style>


