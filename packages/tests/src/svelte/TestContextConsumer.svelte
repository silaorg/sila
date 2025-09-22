<script lang="ts">
  import { provideClientState, getClientStateFromContext } from '@sila/client/state/clientStateContext';

  let { instance }: { instance: any } = $props();

  // Provide and then immediately read back from context
  provideClientState(instance);
  const ctx = getClientStateFromContext();
  const equal = ctx === instance;
</script>

<div data-equal={equal ? 'true' : 'false'}></div>

