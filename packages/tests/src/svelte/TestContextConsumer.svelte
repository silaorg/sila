<script lang="ts">
  import { getClientStateFromContext } from '@sila/client/state/clientStateContext';

  // Simply read from context; provider wraps this component in the test
  const ctx = getClientStateFromContext();
  const equal = !!ctx;
</script>

<div data-equal={equal ? 'true' : 'false'}></div>

