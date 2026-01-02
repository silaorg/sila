<script lang="ts">
  import { Plus } from "lucide-svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { swinsLayout } from "@sila/client/state/swinsLayout";
  import IconButton from "@sila/client/comps/ui/IconButton.svelte";
  import { i18n } from "@sila/client";

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
      i18n.texts.sidebar.newConversationTitle
    );
  }
</script>

<IconButton
  ariaLabel={i18n.texts.tabs.startNewConversation}
  title={i18n.texts.tabs.newConversationShortcut}
  disabled={!hasAppConfig}
  onclick={openNewThread}
  className="ml-4"
>
  {#snippet children()}
    <Plus size={16} />
  {/snippet}
</IconButton>
