<script lang="ts">
    import SpaceSetupWizard from "@sila/client/comps/wizards/SpaceSetupWizard.svelte";
    import ClientStateProvider from "@sila/client/state/ClientStateProvider.svelte";
    import { ClientState } from "@sila/client";
    import { onMount } from "svelte";
    import { buildSpaceFromConfig } from "$lib/demo/buildSpaceFromConfig";

    let loading = $state(true);
    let error: string | null = $state(null);
    let clientState: ClientState = $state(new ClientState());

    onMount(async () => {
        try {
            await clientState.init({});
            const space = await buildSpaceFromConfig({
                type: "sila-space",
                version: "1",
                name: "Gallery Space",
                createdAt: new Date().toISOString(),
                onboarding: true,
                assistants: [],
                providers: [],
                conversations: [],
            });

            await clientState.addDemoSpace(space, space.name);
        } catch (err) {
            error = err instanceof Error ? err.message : String(err);
        } finally {
            loading = false;
        }
    });
</script>

{#if error}
    <div class="alert alert-error">
        Failed to prepare demo space: {error}
    </div>
{/if}

{#if loading}
    <div class="p-4 border rounded-md">Preparing demo space…</div>
{/if}

{#if !loading && !error}
    <ClientStateProvider instance={clientState}>
        <SpaceSetupWizard />
    </ClientStateProvider>
{/if}
