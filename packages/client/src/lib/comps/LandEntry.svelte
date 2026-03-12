<script lang="ts">
	import Loading from './basic/loading.svelte';
	import { useClientState } from '../state/clientStateContext';

	const clientState = useClientState();
</script>

{#if clientState.isLoading}
	<Loading />
{:else}
	<div class="flex min-h-screen">
		<h2 class="text-2xl font-semibold">Welcome to the land!</h2>
	</div>
{/if}
