<script lang="ts">
  import { onMount } from "svelte";
  import { ClientState, SilaApp, type ClientStateConfig } from "@sila/client";
  import { electronFsWrapper } from "./electronFsWrapper";
  import { electronDialogsWrapper } from "./electronDialogsWrapper";
  import DesktopUpdateHandler from "./DesktopUpdateHandler.svelte";
  import DesktopTitleBar from "./DesktopTitleBar.svelte";

  let config: ClientStateConfig | null = $state({
    initState: new ClientState(),
    fs: electronFsWrapper,
    dialog: electronDialogsWrapper
  });

  onMount(() => {
    // Log Electron environment info
    if (typeof process !== "undefined" && process.versions) {
      const info = {
        node: process.versions.node || "N/A",
        chrome: process.versions.chrome || "N/A",
        electron: process.versions.electron || "N/A",
      };

      console.log("⚛️ Electron info:", info);
    }
  });
</script>

<svelte:head>
  <title>Sila</title>
</svelte:head>

<DesktopTitleBar />

<SilaApp {config}>
  <DesktopUpdateHandler />
</SilaApp>

<style global>
  /*
    Desktop-only: fixed custom titlebar overlays the web contents.
    Offset the hover sidebar panel (fixed positioned) so it doesn't cover the titlebar.
  */
  /* svelte-ignore css_unused_selector */
  :global(.hover-sidebar) {
    top: var(--sila-titlebar-height, 0px);
    height: calc(100vh - var(--sila-titlebar-height, 0px));
  }
</style>
