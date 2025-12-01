<script lang="ts">
  import { X } from "lucide-svelte";
  
  let { 
    onClose 
  }: { 
    onClose: (e: Event) => void 
  } = $props();
</script>

<button
  class="ttabs-tab-close flex items-center justify-center"
  onclick={onClose}
>
  <X size={14} class="text-surface-500" />
</button>

<style>
  .ttabs-tab-close {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    width: var(--ttabs-tab-close-size);
    height: var(--ttabs-tab-close-size);
    border-radius: var(--ttabs-tab-close-border-radius);
    transition: background-color 0.1s ease;
  }
  
  .ttabs-tab-close:hover {
    background-color: var(--ttabs-close-button-hover-bg);
  }

  /* Hide close button by default, show when hovering the tab header (VSCode-like) */
  :global(.ttabs-tab-header .ttabs-tab-close) {
    opacity: 0;
  }

  :global(.ttabs-tab-header:hover .ttabs-tab-close),
  :global(.ttabs-tab-header.ttabs-tab-active .ttabs-tab-close:hover) {
    opacity: 1;
  }
</style> 