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
  const isFile = $derived(token.href.startsWith("<file:") || token.href.startsWith("file:"));
</script>

{#if isFile}
  <FileMentionInAMessage path={token.href} title={token.title} relativeRootVertex={filesVertex}>{@render children()}</FileMentionInAMessage>
{:else}   
  <a class="anchor" target="_blank" href={token.href} title={token.title}
    >{@render children()}</a
  >
{/if}
