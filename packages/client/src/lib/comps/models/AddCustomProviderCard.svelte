<script lang="ts">
  import { PlusCircle } from "lucide-svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  const clientState = useClientState();

  let {
    onProviderAdded = () => {},
  }: {
    onProviderAdded?: () => void;
  } = $props();

  function handleAdd() {
    clientState.layout.swins.open('custom-provider-setup', {
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