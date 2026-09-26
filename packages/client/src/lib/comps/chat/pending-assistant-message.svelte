<script lang="ts">
	import Sparkles from 'lucide-svelte/icons/sparkles';
	import type { ThreadProgress } from '../../api-client';
	import ToolUsageItem from './tool-usage-item.svelte';

	let { progress }: { progress: ThreadProgress | null } = $props();
	const statusLabel = $derived(
		progress?.status === 'acting'
			? 'Acting'
			: progress?.status === 'thinking'
				? 'Thinking'
				: 'Processing'
	);
</script>

<div class="flex gap-3 px-4 py-2">
	<div class="mt-1 shrink-0">
		<div class="flex size-8 items-center justify-center rounded-full">
			<Sparkles size={18} />
		</div>
	</div>
	<div class="min-w-0 max-w-[85%]">
		<div class="mb-2 mt-2 flex items-center gap-2">
			<span class="cursor-default font-bold">Heswe</span>
			<span class="opacity-70">•</span>
			<span class="loading-dots opacity-70">{statusLabel}</span>
		</div>
		{#if progress?.activities.length}
			<div class="mb-2 flex flex-col gap-2 text-sm opacity-80">
				{#each progress.activities.slice(-5) as activity (activity.id)}
					<ToolUsageItem {activity} />
				{/each}
			</div>
		{/if}
	</div>
</div>
