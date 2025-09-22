<script lang="ts">
  import { provideClientState } from './clientStateContext';
  import { ClientState } from './clientState.svelte';

  let { instance = new ClientState() } = $props<{ instance?: ClientState }>();

  provideClientState(instance);
</script>

<slot />

