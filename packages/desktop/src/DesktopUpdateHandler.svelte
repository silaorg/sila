<script lang="ts">
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { onMount } from "svelte";
  const clientState = useClientState();

  onMount(() => {
    // Listen for update downloaded event from main via preload API
    const off = (globalThis as any)?.desktopUpdater?.onUpdateDownloaded?.((payload: { version?: string }) => {
      const version = payload?.version ?? "";
      clientState.toast.info(`A new version of Sila is ready! Version: ${version}`, {
        dismissable: true,
        duration: Infinity,
        closeButton: true,
        action: {
          label: "Restart to update",
          onClick: async () => {
            try {
              await (globalThis as any)?.desktopUpdater?.installUpdate?.();
            } catch (e) {
              console.error("Failed to install update:", e);
            }
          },
        },
      });
    });

    return () => {
      if (typeof off === 'function') off();
    };
  });
</script>
