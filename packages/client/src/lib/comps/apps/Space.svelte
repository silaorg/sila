<script lang="ts">
  import SpaceInspectorWindow from "../space-inspector/SpaceInspectorWindow.svelte";
  import DevPanel from "../dev/DevPanel.svelte";
  import { isDevMode, spaceInspectorOpen } from "@sila/client/state/devMode";
  import OllamaAutoConfig from "../models/OllamaAutoConfig.svelte";
  import SpaceTTabsLayout from "../SpaceTTabsLayout.svelte";
  import HoverSidebar from "../sidebar/HoverSidebar.svelte";
  import SpaceSetupWizard from "../wizards/SpaceSetupWizard.svelte";
  import type { SpaceState } from "@sila/client/state/spaceState.svelte";

  let { spaceState }: { spaceState: SpaceState } = $props();

  let onboarding = $state(false);

  $effect(() => {
    const space = spaceState.space;

    if (!space) {
      return;
    }

    const spaceRoot = space.tree.root!;

    onboarding = spaceRoot.getProperty("onboarding") as boolean;

    const observer = spaceRoot.observe(() => {
      onboarding = spaceRoot.getProperty("onboarding") as boolean;
    });

    return () => {
      observer();
    };
  });
</script>

<!-- Set a periodic check for Ollama running and setup it as a model provider if it is setup -->
<OllamaAutoConfig />

{#if onboarding}
  <SpaceSetupWizard />
{:else}
  <div
    class="grid h-screen grid-rows-[1fr_auto] border-t border-surface-200-800"
    data-testid="space-root"
  >
    <div class="flex overflow-hidden">
      <main class="relative flex-grow h-full overflow-y-auto">
        <SpaceTTabsLayout {spaceState} />
      </main>
    </div>

    {#if $isDevMode}
      <div
        class="w-full border-t border-surface-200-800 bg-surface-100-800-token"
      >
        <DevPanel />
      </div>
    {/if}
  </div>

  <!-- This sidebar works when the regular column-based sidebar is closed -->
  <HoverSidebar />

  {#if $isDevMode && $spaceInspectorOpen}
    <SpaceInspectorWindow />
  {/if}
{/if}
