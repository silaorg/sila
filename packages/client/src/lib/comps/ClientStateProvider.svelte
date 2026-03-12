<script lang="ts">
	import type { Snippet } from 'svelte';
	import { provideClientState } from '../state/clientStateContext';
	import { ClientState } from '../state/clientState.svelte';

	let {
		instance,
		children
	}: {
		instance?: ClientState;
		children: Snippet;
	} = $props();

	const fallbackInstance = new ClientState();

	provideClientState(() => instance ?? fallbackInstance);
</script>

{@render children()}
