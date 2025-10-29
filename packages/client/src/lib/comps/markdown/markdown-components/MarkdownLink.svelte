<script lang="ts">
  import type { Tokens } from "@markpage/svelte";
  import type { Snippet } from "svelte";

  let { token, children } = $props<{
    token: Tokens.Link;
    children: Snippet;
  }>();
</script>

<a class="anchor" target="_blank" href={token.href} title={token.title}
  >{@render children()}</a
>
