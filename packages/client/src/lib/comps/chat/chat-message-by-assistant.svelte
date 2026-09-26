<script lang="ts">
	import ChevronDown from 'lucide-svelte/icons/chevron-down';
	import ChevronRight from 'lucide-svelte/icons/chevron-right';
	import Sparkles from 'lucide-svelte/icons/sparkles';
	import type { ThreadMessage } from '../../api-client';
	import MessageText from './message-text.svelte';
	import ToolUsageItem from './tool-usage-item.svelte';

	let { message, threadId }: { message: ThreadMessage; threadId: string } = $props();
	let expanded = $state(false);
	const activities = $derived(message.activities ?? []);
</script>

<div class="flex scroll-mt-2 gap-3 px-4 py-2">
	<div class="mt-1 shrink-0">
		<div class="flex size-8 items-center justify-center rounded-full">
			<Sparkles size={18} />
		</div>
	</div>
	<div class="min-w-0 max-w-[85%]">
		<div class="mb-2 mt-2 flex items-center gap-2">
			<span class="cursor-default font-bold">Heswe</span>
			{#if activities.length > 0}
				<span class="opacity-70">•</span>
				<button
					type="button"
					class="group flex items-center gap-1"
					aria-expanded={expanded}
					onclick={() => (expanded = !expanded)}
				>
					<span class="opacity-70 group-hover:opacity-100">Acted</span>
					{#if expanded}
						<ChevronDown size={12} class="opacity-70 group-hover:opacity-100" />
					{:else}
						<ChevronRight size={12} class="opacity-70 group-hover:opacity-100" />
					{/if}
				</button>
			{/if}
		</div>

		<div class="relative rounded-lg selectable-text">
			{#if expanded}
				<div class="mb-2 mt-2 flex max-h-96 flex-col gap-2 overflow-y-auto text-sm opacity-80">
					{#each activities as activity (activity.id)}
						<ToolUsageItem {activity} />
					{/each}
				</div>
			{/if}
			<MessageText text={message.text} {threadId} />
		</div>
	</div>
</div>
