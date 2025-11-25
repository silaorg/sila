<script lang="ts">
  import type { AppConfig } from "@sila/core";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import NewThread from "@sila/client/comps/apps/NewThread.svelte";
  const clientState = useClientState();

  let { appConfig, targetPanelId }: { appConfig?: AppConfig; targetPanelId?: string } = $props();

  function onSend() {
    clientState.layout.swins.clear();
  }
</script>

<NewThread {appConfig} {onSend} {targetPanelId} />
