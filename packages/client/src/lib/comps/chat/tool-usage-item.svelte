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
	const displayPreview = $derived(
		activity.preview.replace(/^\/.*?\/((?:assets|files)\/.*)$/, '$1')
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
	<div class="flex min-w-0 items-start gap-2">
		<span class="mt-1 shrink-0" aria-label={activity.status === 'running' ? 'Running' : 'Completed'}>
			{#if activity.status === 'running'}
				<LoaderCircle size={14} class="animate-spin opacity-70" />
			{:else}
				<Check size={14} class="opacity-70" />
			{/if}
		</span>
		<ToolIcon size={14} class="mt-1 shrink-0 opacity-70" />
		<div class="min-w-0 flex-1">
			<div class="font-medium">{displayName}</div>
			{#if activity.preview}
				<div class="truncate text-xs opacity-60" title={activity.preview}>{displayPreview}</div>
			{/if}
		</div>
	</div>
</div>
