<script lang="ts">
  import { PlusCircle } from "lucide-svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { swinsLayout } from "@sila/client/state/swinsLayout";
  const clientState = useClientState();

  let {
    onProviderAdded = () => {},
  }: {
    onProviderAdded?: () => void;
  } = $props();

  function handleAdd() {
    clientState.layout.swins.open(swinsLayout.customProviderSetup.key, {
      onSave: () => {
        onProviderAdded();
        clientState.layout.swins.pop();
      }
    }, 'Add Custom OpenAI-like Provider');
  }
</script>

<div class="card p-4 flex items-center justify-center">
  <button
    class="btn preset-outlined-surface-500 flex items-center gap-2"
    onclick={handleAdd}
  >
    <PlusCircle size={16} />
    <span>Add Custom Provider</span>
  </button>
</div> 
