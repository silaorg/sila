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

<SilaApp {config}>
  <DesktopUpdateHandler />
  <DesktopTitleBar />
</SilaApp>

<style global>
  /*
    Desktop-only: fixed custom titlebar overlays the web contents.
    Offset a few fixed/viewport-rooted surfaces so they don't sit under the titlebar.
  */
  /* Main app root (Space) */
  /* svelte-ignore css_unused_selector */
  :global([data-testid="space-root"]) {
    padding-top: var(--sila-titlebar-height, 0px);
    box-sizing: border-box;
  }

  /* svelte-ignore css_unused_selector */
  :global(.hover-sidebar) {
    /* Override Tailwind's `top-0`/`h-full` reliably (ordering can vary across bundles). */
    top: var(--sila-titlebar-height, 0px) !important;
    height: calc(100vh - var(--sila-titlebar-height, 0px)) !important;
  }
</style>
