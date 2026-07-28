<script lang="ts">
	import BookOpen from 'lucide-svelte/icons/book-open';
	import Check from 'lucide-svelte/icons/check';
	import Eye from 'lucide-svelte/icons/eye';
	import FilePenLine from 'lucide-svelte/icons/file-pen-line';
	import LoaderCircle from 'lucide-svelte/icons/loader-circle';
	import Search from 'lucide-svelte/icons/search';
	import Wrench from 'lucide-svelte/icons/wrench';
	import type { ThreadActivity } from '../../api-client';

	let { activity }: { activity: ThreadActivity } = $props();
	const normalized = $derived(activity.name.toLowerCase());
	const displayName = $derived(
		activity.name
			.replaceAll('_', ' ')
			.replace(/^\w/, (character) => character.toUpperCase())
	);
	const ToolIcon = $derived.by(() => {
		if (normalized.includes('edit') || normalized.includes('write') || normalized.includes('patch')) {
			return FilePenLine;
		}
		if (normalized.includes('look') || normalized.includes('inspect') || normalized === 'see') {
			return Eye;
		}
		if (normalized.includes('search')) return Search;
		if (normalized.includes('read')) return BookOpen;
		return Wrench;
	});
</script>

<div class="rounded-md border border-surface-100-900 p-2 text-left">
	<span class="inline-flex min-w-0 items-center gap-2">
		{#if activity.status === 'running'}
			<LoaderCircle size={14} class="animate-spin opacity-70" />
		{:else}
			<Check size={14} class="opacity-70" />
		{/if}
		<ToolIcon size={14} class="opacity-70" />
		<span class="font-medium">{displayName}</span>
		{#if activity.preview}
			<span class="max-w-80 truncate opacity-60">"{activity.preview}"</span>
		{/if}
	</span>
</div>
