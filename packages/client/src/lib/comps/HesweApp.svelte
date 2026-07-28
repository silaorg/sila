<script lang="ts">
	import '../compiled-style.css';
	import ClientStateProvider from './ClientStateProvider.svelte';
	import { ClientState } from '../state/clientState.svelte';
	import LandEntry from './LandEntry.svelte';
	import LoadingOverlay from './basic/loading-overlay.svelte';

	let {
		clientState = new ClientState()
	}: {
		clientState?: ClientState;
	} = $props();

	$effect(() => {
		clientState.init();
	});
</script>

<ClientStateProvider instance={clientState}>
	<LoadingOverlay visible={clientState.isLoading} />
	<LandEntry />
</ClientStateProvider>
