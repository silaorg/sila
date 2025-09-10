<script lang="ts">
  import type { Tokens } from "marked";
  import MarkdownTeX from "./MarkdownTeX.svelte";

  let { token }: { token?: Tokens.Codespan } = $props();
</script>

<MarkdownTeX {token} isBlock={true} />
