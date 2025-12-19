<script lang="ts">
  import type { Tokens } from "@markpage/svelte";
  import type { Snippet } from "svelte";
  import FileMentionInAMessage from "../../apps/chat/FileMentionInAMessage.svelte";
  import { useChatAppDataOptional } from "../../apps/chat/chatAppContext";

  let { token, children } = $props<{
    token: Tokens.Link;
    children: Snippet;
  }>();

  const chatAppData = useChatAppDataOptional();
  const filesVertex = $derived(chatAppData?.getFilesRoot(false));
  const href = $derived(
    token.href?.startsWith("<") && token.href.endsWith(">")
      ? token.href.slice(1, -1)
      : token.href
  );
  const isFile = $derived(
    href.startsWith("file:") || href.startsWith("fref:")
  );
</script>

{#if isFile}
  <FileMentionInAMessage path={href} title={token.title} relativeRootVertex={filesVertex}>{@render children()}</FileMentionInAMessage>
{:else}   
  <a class="anchor" target="_blank" href={href} title={token.title}
    >{@render children()}</a
  >
{/if}
