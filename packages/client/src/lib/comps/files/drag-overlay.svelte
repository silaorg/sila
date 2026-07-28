<script lang="ts">
	import File from 'lucide-svelte/icons/file';
	import Folder from 'lucide-svelte/icons/folder';
	import type { WorkspaceFsEntry } from '../../api-client';

	let {
		items,
		x,
		y
	}: {
		items: WorkspaceFsEntry[];
		x: number;
		y: number;
	} = $props();

	const topItems = $derived(items.slice(0, 6));
</script>

<div
	class="pointer-events-none fixed z-[9999]"
	style={`left:${x + 12}px; top:${y + 12}px`}
>
	<div class="min-w-[200px] max-w-[360px]">
		<div
			class="inline-flex size-7 items-center justify-center rounded-full bg-primary-600 text-xs font-medium text-white shadow-md"
		>
			{items.length}
		</div>
		<div class="mt-1 flex flex-col gap-1 pl-4">
			{#each topItems as item (item.path)}
				<div class="flex items-center gap-2 truncate text-sm opacity-50">
					{#if item.type === 'directory'}
						<Folder size={16} />
					{:else}
						<File size={16} />
					{/if}
					<span class="truncate">{item.name}</span>
				</div>
			{/each}
			{#if items.length > topItems.length}
				<div class="text-[11px] opacity-50">
					+{items.length - topItems.length} more
				</div>
			{/if}
		</div>
	</div>
</div>
