<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { loadingState } from '../../state/loading.svelte';

	onMount(() => {
		loadingState.show();
	});

	onDestroy(() => {
		loadingState.hide();
	});
</script>
