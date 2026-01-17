<script lang="ts">
  import CenteredPage from "../basic/CenteredPage.svelte";
  import NewThread from "./NewThread.svelte";
  import SidebarToggle from "../sidebar/SidebarToggle.svelte";
  import SidebarCollapsedSettings from "../sidebar/SidebarCollapsedSettings.svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  const clientState = useClientState();

  let sidebarIsOpen = $derived(
    clientState.currentSpaceState?.layout.sidebar.isOpen,
  );
</script>

<div class="flex flex-col h-full w-full items-center justify-center relative">
  {#if !sidebarIsOpen}
    <div class="absolute top-2 left-2 flex gap-1">
      <SidebarCollapsedSettings />
      <SidebarToggle />
    </div>
  {/if}
  <CenteredPage>
    <NewThread />
  </CenteredPage>
</div>
