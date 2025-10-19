<script lang="ts">
  import { Popover } from "@skeletonlabs/skeleton-svelte";
  import type { Snippet } from "svelte";
  import { TargetVisibilityMonitor } from "../../utils/visibility-monitor";

  let {
    open = false,
    onOpenChange,
    placement = "bottom",
    zIndex = "50",
    closeOnInteractOutside = true,
    closeOnEscape = true,
    triggerClassNames = "",
    maxWidth = "320px",
    content,
    trigger,
    arrow = true,
    onTargetHidden,
  }: {
    open: boolean;
    onOpenChange: (e: { open: boolean }) => void;
    placement?: "top" | "right" | "bottom" | "left";
    zIndex?: string;
    closeOnInteractOutside?: boolean;
    closeOnEscape?: boolean;
    triggerClassNames?: string;
    maxWidth?: string;
    content: Snippet<[]>;
    trigger: Snippet<[]>;
    arrow?: boolean;
    onTargetHidden?: () => void;
  } = $props();

  let visibilityMonitor: TargetVisibilityMonitor | null = null;
  let wrapperElement: HTMLElement;

  // Find the trigger element automatically
  function findTriggerElement(): HTMLElement | null {
    if (!wrapperElement) return null;
    
    // Look for the trigger element - it's usually the first clickable element
    // The Popover component typically puts a data attribute or role on the trigger
    const triggerCandidate = wrapperElement.querySelector('[data-popover-trigger], [role="button"], button');
    if (triggerCandidate instanceof HTMLElement) {
      return triggerCandidate;
    }
    
    // Fallback: first child element that's not the popover content
    const firstChild = wrapperElement.firstElementChild;
    if (firstChild instanceof HTMLElement) {
      return firstChild;
    }
    
    return null;
  }

  // Monitor target visibility when menu is open
  $effect(() => {
    if (open) {
      const triggerElement = findTriggerElement();
      if (triggerElement) {
        visibilityMonitor = new TargetVisibilityMonitor(
          triggerElement,
          () => {
            onOpenChange({ open: false });
            onTargetHidden?.();
          }
        );
        visibilityMonitor.start();
      }
    } else {
      visibilityMonitor?.stop();
      visibilityMonitor = null;
    }

    // Cleanup on component destroy
    return () => {
      visibilityMonitor?.stop();
    };
  });
</script>

<div bind:this={wrapperElement}>
  <Popover
    {zIndex}
    {open}
    {onOpenChange}
    positioning={{ placement }}
    triggerBase={`${triggerClassNames}`}
    contentBase={`context-menu card bg-surface-50-950 border border-surface-100-900 shadow-lg p-2 space-y-2 max-w-[${maxWidth}]`}
    {arrow}
    arrowBackground="!bg-surface-50-950"
    {closeOnInteractOutside}
    {closeOnEscape}
  >
    {#snippet trigger()}
      {#if trigger}
        {@render trigger()}
      {/if}
    {/snippet}
    
    {#snippet content()}
      {#if content}
        {@render content()}
      {/if}
    {/snippet}
  </Popover>
</div> 