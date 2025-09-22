<script lang="ts">
  import { useClientState } from "@sila/client/state/clientStateContext";
  import Loading from "@sila/client/comps/basic/Loading.svelte";
  import FreshStartWizard from "@sila/client/comps/wizards/FreshStartWizard.svelte";
  import Space from "./apps/Space.svelte";
  import Spaces from "../swins/routes/Spaces.svelte";
  import CenteredPage from "./basic/CenteredPage.svelte";
  const clientState = useClientState();
</script>

{#if clientState.isInitializing || clientState.spaceStatus === "loading"}
  <Loading />
{:else if clientState.needsSpace}
  <FreshStartWizard />
{:else if clientState.isReady}
  {#if clientState.currentSpaceState}
    <Space spaceState={clientState.currentSpaceState} />
  {:else}
    <CenteredPage>
      <Spaces />
    </CenteredPage>
  {/if}
{:else if clientState.initializationError}
  <div class="p-4 text-red-500">
    <h2>Initialization Error</h2>
    <p>{clientState.initializationError}</p>
  </div>
{/if}
