<svelte:head>
	<title>Heswe Web</title>
	<meta
		name="description"
		content="Thin SvelteKit wrapper for the shared Heswe client."
	/>
</svelte:head>

<script lang="ts">
	import { HesweApp } from '@heswe/client';
</script>

<HesweApp />
