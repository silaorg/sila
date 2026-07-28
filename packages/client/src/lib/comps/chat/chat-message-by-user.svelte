<script lang="ts">
	import type { ThreadMessage } from '../../api-client';
	import MessageAttachment from './message-attachment.svelte';
	import MessageText from './message-text.svelte';

	let { message, threadId }: { message: ThreadMessage; threadId: string } = $props();
</script>

<div class="flex scroll-mt-2 justify-end gap-3 px-4 py-2">
	<div class="ml-auto min-w-0 max-w-[85%]">
		<div class="rounded-lg bg-surface-100-900/50 p-3 selectable-text">
			{#if message.attachments.length > 0}
				<div class="mb-4 flex flex-wrap justify-end gap-2">
					{#each message.attachments as attachment (attachment.reference)}
						<MessageAttachment {attachment} {threadId} />
					{/each}
				</div>
			{/if}
			{#if message.text}
				<MessageText text={message.text} {threadId} />
			{/if}
		</div>
	</div>
</div>
