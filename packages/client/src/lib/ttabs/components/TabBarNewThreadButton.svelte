<script lang="ts">
  import { Plus } from "lucide-svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";

  const clientState = useClientState();

  let { ttabs: _ttabs, panelId: _panelId }: { ttabs: unknown; panelId: string } = $props();

  const hasAppConfig = $derived(
    (clientState.currentSpace?.getAppConfigs()?.length ?? 0) > 0
  );

  function openNewThread() {
    if (!hasAppConfig) return;

    clientState.layout.swins.open("new-thread", {}, "New conversation");
  }
</script>

<button
  type="button"
  class="flex items-center justify-center gap-1 px-4 py-1 rounded text-surface-700-300 hover:text-surface-900-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-500"
  onclick={openNewThread}
  aria-label="Start a new conversation"
  title="New conversation (Cmd/Ctrl + N)"
  disabled={!hasAppConfig}
>
  <Plus size={16} />
</button>
