<script lang="ts">
	import BookOpen from 'lucide-svelte/icons/book-open';
	import CircleAlert from 'lucide-svelte/icons/circle-alert';
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
	<span class="flex min-w-0 items-center gap-2 text-sm">
		{#if activity.status === 'running'}
			<LoaderCircle size={14} class="shrink-0 animate-spin opacity-70" />
		{:else if activity.status === 'complete'}
			<Check size={14} class="shrink-0 opacity-70" />
		{:else}
			<CircleAlert size={14} class="shrink-0 text-warning-600-400" />
		{/if}
		<ToolIcon size={14} class="shrink-0 opacity-70" />
		<span class="shrink-0 font-medium">{displayName}</span>
		{#if activity.preview}
			<span class="min-w-0 truncate opacity-60" title={activity.preview}>"{activity.preview}"</span>
		{/if}
		<span class="ml-auto shrink-0 text-xs opacity-70">{activity.status === 'incomplete' ? 'No result' : activity.status === 'failed' ? 'Failed' : activity.status === 'running' ? 'Running' : 'Complete'}</span>
	</span>
</div>
