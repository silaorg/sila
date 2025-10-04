<script lang="ts">
  import { onMount } from "svelte";
  import { ClientState, SilaApp, type ClientStateConfig } from "@sila/client";
  import { electronFsWrapper } from "./electronFsWrapper";
  import { electronDialogsWrapper } from "./electronDialogsWrapper";
  import ClientStateProvider from "@sila/client/state/ClientStateProvider.svelte";
  import DesktopUpdateHandler from "./DesktopUpdateHandler.svelte";

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

<SilaApp {config} />

<ClientStateProvider instance={config.initState}>
  <DesktopUpdateHandler />
</ClientStateProvider>