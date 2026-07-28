<script lang="ts">
	import { useWorkspaceUi } from '../../workspace-ui-context';

	let { text, threadId }: { text: string; threadId: string } = $props();
	const workspaceUi = useWorkspaceUi();
	let segments = $derived(parseMessage(text));
</script>

<span class="whitespace-pre-wrap">
	{#each segments as segment}
		{#if segment.reference}
			<a
				class="chat-file-mention anchor"
				href={workspaceUi.getFileUrl(threadId, segment.reference)}
				target="_blank"
				rel="noreferrer"
				title={segment.reference}
			>{segment.text}</a>
		{:else}
			{segment.text}
		{/if}
	{/each}
</span>

<script module lang="ts">
	function parseMessage(text: string) {
		const segments: Array<{ text: string; reference?: string }> = [];
		const pattern = /\[([^\]]+)\]\(<((?:workspace|thread):[^>]+)>\)/g;
		let offset = 0;
		for (const match of text.matchAll(pattern)) {
			if (match.index > offset) segments.push({ text: text.slice(offset, match.index) });
			segments.push({ text: match[1], reference: match[2] });
			offset = match.index + match[0].length;
		}
		if (offset < text.length) segments.push({ text: text.slice(offset) });
		return segments;
	}
</script>
