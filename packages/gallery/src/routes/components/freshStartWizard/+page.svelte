<script lang="ts">
  import FreshStartWizard from "@sila/client/comps/wizards/FreshStartWizard.svelte";
  import ClientStateProvider from "@sila/client/comps/ClientStateProvider.svelte";
  import { ClientState } from "@sila/client";
  import { onMount } from "svelte";

  let loading = $state(true);
  let error: string | null = $state(null);
  let clientState: ClientState = $state(new ClientState());

  onMount(async () => {
    try {
      await clientState.init({});
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  });
</script>

{#if error}
  <div class="alert alert-error">
    Failed to initialize client state: {error}
  </div>
{/if}

{#if loading}
  <div class="p-4 border rounded-md">Initializing client state…</div>
{/if}

{#if !loading && !error}
  <ClientStateProvider instance={clientState}>
    <FreshStartWizard />
  </ClientStateProvider>
{/if}
