<script lang="ts">
  import { onMount } from "svelte";
  import { ClientState, SilaApp, type ClientStateConfig } from "@sila/client";
  import { electronFsWrapper } from "./electronFsWrapper";
  import { electronDialogsWrapper } from "./electronDialogsWrapper";
  import DesktopUpdateHandler from "./DesktopUpdateHandler.svelte";

  let config: ClientStateConfig | null = $state({
    initState: new ClientState(),
    fs: electronFsWrapper,
    dialog: electronDialogsWrapper
  });

  onMount(() => {
    // Forward main-process logs into the renderer console (dev convenience).
    const unsubMainLogs = (window as any).desktopLogs?.onMainLog?.((payload: any) => {
      const level = payload?.level;
      const msg = payload?.message ?? payload;
      const fn = (console as any)[level] ?? console.log;
      fn("[electron]", msg);
    });

    // Log Electron environment info
    if (typeof process !== "undefined" && process.versions) {
      const info = {
        node: process.versions.node || "N/A",
        chrome: process.versions.chrome || "N/A",
        electron: process.versions.electron || "N/A",
      };

      console.log("⚛️ Electron info:", info);
    }

    return () => {
      if (typeof unsubMainLogs === "function") unsubMainLogs();
    };
  });
</script>

<svelte:head>
  <title>Sila</title>
</svelte:head>

<SilaApp {config}>
  <DesktopUpdateHandler />
</SilaApp>