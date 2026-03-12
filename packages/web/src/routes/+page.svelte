<svelte:head>
	<title>Silaland Web</title>
	<meta
		name="description"
		content="Thin SvelteKit wrapper for the shared Sila client."
	/>
</svelte:head>

<script lang="ts">
	import { SilaApp } from '@sila/client';
</script>

<SilaApp />
