<script lang="ts">
import type { Tokens } from '@markpage/svelte'

let { token } = $props<{
  token: Tokens.Codespan
}>();
</script>

<code class="preset-tonal rounded p-[3px]">{token.raw.slice(1, token.raw.length - 1)}</code>
