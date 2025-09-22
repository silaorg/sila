<script lang="ts">
  import { provideClientState } from './clientStateContext';
  import { ClientState } from './clientState.svelte';

  let { instance = new ClientState(), children } = $props<{ instance?: ClientState; children?: any }>();

  provideClientState(instance);
</script>

{#if children}
  {@render children()}
{/if}

