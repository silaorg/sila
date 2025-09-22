<script lang="ts">
  // client state is provided via context accessor
  import PanelLeftClose from "lucide-svelte/icons/panel-left-close";
  import PanelLeftOpen from "lucide-svelte/icons/panel-left-open";

  import { useClientState } from "@sila/client/state/clientStateContext";
  const clientState = useClientState();
  const sidebar = $derived(clientState.currentSpaceState?.layout.sidebar);
</script>

<button
  class="p-2 rounded hover:preset-tonal"
  onclick={() => sidebar?.toggle()}
  title={sidebar?.isOpen ? "Collapse sidebar" : "Expand sidebar"}
  aria-label={sidebar?.isOpen ? "Collapse sidebar" : "Expand sidebar"}
>
  {#if sidebar?.isOpen}
    <PanelLeftClose size={18} />
  {:else}
    <PanelLeftOpen size={18} />
  {/if}
</button>
