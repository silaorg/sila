<script lang="ts">
  import katex from "katex";
  import type { Tokens } from "marked";

  let { token, isBlock }: { token?: Tokens.Codespan, isBlock?: boolean } = $props();
  let output: HTMLElement;

  $effect(() => {
    if (output && token?.text) {
      katex.render(token.text, output, { 
        displayMode: isBlock ?? false,
        throwOnError: false
      });
    }
  });
</script>

<span bind:this={output}></span>
