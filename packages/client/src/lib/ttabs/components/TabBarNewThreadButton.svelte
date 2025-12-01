<script lang="ts">
  import { Plus } from "lucide-svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { swinsLayout } from "@sila/client/state/swinsLayout";
  import IconButton from "@sila/client/comps/ui/IconButton.svelte";

  const clientState = useClientState();

  let { ttabs: _ttabs, panelId }: { ttabs: unknown; panelId: string } = $props();

  const hasAppConfig = $derived(
    (clientState.currentSpace?.getAppConfigs()?.length ?? 0) > 0
  );

  function openNewThread() {
    if (!hasAppConfig) return;

    clientState.layout.swins.open(
      swinsLayout.newThread.key,
      { targetPanelId: panelId },
      "New conversation"
    );
  }
</script>

<IconButton
  ariaLabel="Start a new conversation"
  title="New conversation (Cmd/Ctrl + N)"
  disabled={!hasAppConfig}
  onclick={openNewThread}
  className="ml-4"
>
  {#snippet children()}
    <Plus size={16} />
  {/snippet}
</IconButton>
