<script lang="ts">
	let {
		path,
		onNavigate
	}: {
		path: string;
		onNavigate: (path: string) => void;
	} = $props();

	const crumbs = $derived([
		{ name: 'Files', path: '' },
		...path.split('/').filter(Boolean).map((name, index, parts) => ({
			name,
			path: parts.slice(0, index + 1).join('/')
		}))
	]);
</script>

<nav class="flex min-w-0 flex-wrap items-center gap-1.5 text-lg font-medium" aria-label="File path">
	{#each crumbs as crumb, index (crumb.path)}
		{#if index > 0}
			<span class="opacity-50">/</span>
		{/if}
		<button
			type="button"
			class="max-w-48 truncate rounded px-1.5 py-1 transition-colors hover:bg-surface-500/10"
			title={crumb.name}
			data-directory-path={crumb.path}
			onclick={() => onNavigate(crumb.path)}
		>
			{crumb.name}
		</button>
	{/each}
</nav>
