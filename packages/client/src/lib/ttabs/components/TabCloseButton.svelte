<script lang="ts">
  import { X } from "lucide-svelte";
  import IconButton from "@sila/client/comps/ui/IconButton.svelte";
  import { i18n } from "@sila/client";

  let {
    onClose
  }: {
    onClose: (e: Event) => void
  } = $props();
</script>

<IconButton
  ariaLabel={i18n.texts.tabs.closeTab}
  title={i18n.texts.tabs.closeTab}
  onclick={onClose}
  className="ttabs-tab-close"
>
  {#snippet children()}
    <X size={14} />
  {/snippet}
</IconButton>

<style>
  /* Class is applied via a component prop, so use :global to avoid false-positive "unused selector" warnings. */
  :global(.ttabs-tab-close) {
    width: var(--ttabs-tab-close-size);
    height: var(--ttabs-tab-close-size);
    border-radius: var(--ttabs-tab-close-border-radius);
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
