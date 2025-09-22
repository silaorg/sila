<script lang="ts">
  import type { AppConfig } from "@sila/core";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import NewThread from "@sila/client/comps/apps/NewThread.svelte";
  const clientState = useClientState();

  let { appConfig }: { appConfig?: AppConfig } = $props();

  function onSend() {
    clientState.layout.swins.clear();
  }
</script>

<NewThread {appConfig} {onSend} />
