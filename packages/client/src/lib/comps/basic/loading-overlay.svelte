<script lang="ts">
	import { fade } from 'svelte/transition';
	import { loadingState } from '../../state/loading.svelte';

	let { visible = false }: { visible?: boolean } = $props();
</script>

{#if visible || loadingState.count > 0}
	<div
		out:fade={{ duration: 200, delay: 300 }}
		class="fixed inset-0 z-50 flex items-center justify-center bg-surface-50-950"
	>
		<div
			class="h-12 w-12 animate-spin rounded-full border-[0.3rem] border-surface-200-800 border-t-primary-500"
		></div>
	</div>
{/if}
