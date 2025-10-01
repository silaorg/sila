<script lang="ts">
  import { onMount } from "svelte";
  import { SilaApp, ClientStateProvider, ClientState } from "@sila/client";
  import { loadDemoSpace } from "$lib/loadDemoSpace";

  let demoConfigUrl: string = "/api/demo-space";
  let loading = $state(true);
  let error: string | null = $state(null);
  let localState: ClientState | null = $state(null);

  onMount(async () => {
    try {
      const { state } = await loadDemoSpace({ configUrl: demoConfigUrl });
      localState = state;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  });
</script>

{#if error}
  <div>Error: {error}</div>
{:else if loading}
  <div>Loading demo space…</div>
{:else if localState}
  <SilaApp config={{}} state={localState} />
{:else}
  <div>Demo space not loaded</div>
{/if}
