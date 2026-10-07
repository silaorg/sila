<script module lang="ts">
	export const MESSAGE_RESOURCE_URL = Symbol('message-resource-url');
</script>

<script lang="ts">
	import { getContext, type Snippet } from 'svelte';
	import type { Tokens } from '@markpage/svelte';

	let { token, children }: { token: Tokens.Link | Tokens.Image; children?: Snippet } = $props();
	const resolveUrl = getContext<(href: string) => string>(MESSAGE_RESOURCE_URL);
	const url = $derived(resolveUrl(token.href));
</script>

{#if token.type === 'image'}
	<img src={url} alt={token.text} title={token.title ?? undefined} class="max-w-full" />
{:else}
	<a href={url} title={token.title ?? undefined}>{@render children?.()}</a>
{/if}
