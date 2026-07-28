<script lang="ts">
	import { Markdown } from '@markpage/svelte';
	import { useWorkspaceUi } from '../../workspace-ui-context';

	let { text, threadId }: { text: string; threadId: string } = $props();
	const workspaceUi = useWorkspaceUi();
	let source = $derived(rewriteFileMentions(text, threadId, workspaceUi.getFileUrl));
</script>

<div class="chat-message">
	<Markdown {source} />
</div>

<script module lang="ts">
	function rewriteFileMentions(
		text: string,
		threadId: string,
		getFileUrl: (threadId: string, reference: string) => string
	) {
		const pattern = /\[([^\]]+)\]\(<((?:workspace|thread):[^>]+)>\)/g;
		return text.replace(
			pattern,
			(_match, name: string, reference: string) =>
				`[${name}](${getFileUrl(threadId, reference)})`
		);
	}
</script>

<style>
	:global(.chat-message) {
		overflow-wrap: anywhere;
		white-space: normal;
	}

	:global(.chat-message p + p),
	:global(.chat-message pre),
	:global(.chat-message ul),
	:global(.chat-message ol),
	:global(.chat-message blockquote) {
		margin-top: 0.75rem;
	}

	:global(.chat-message ul) {
		list-style: disc;
		padding-left: 1.25rem;
	}

	:global(.chat-message ol) {
		list-style: decimal;
		padding-left: 1.25rem;
	}

	:global(.chat-message pre) {
		overflow-x: auto;
		border-radius: 0.5rem;
		background: color-mix(in oklab, var(--color-surface-950) 6%, transparent);
		padding: 0.75rem;
	}

	:global(.dark .chat-message pre) {
		background: color-mix(in oklab, var(--color-surface-50) 8%, transparent);
	}

	:global(.chat-message code) {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 0.875em;
	}

	:global(.chat-message h1) {
		margin: 0.75rem 0;
		font-size: 1.5rem;
		font-weight: 700;
	}

	:global(.chat-message h2) {
		margin: 0.75rem 0;
		font-size: 1.25rem;
		font-weight: 700;
	}

	:global(.chat-message h3) {
		margin: 0.5rem 0;
		font-size: 1.125rem;
		font-weight: 600;
	}
</style>
