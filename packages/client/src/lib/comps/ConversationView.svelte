<script lang="ts">
	import ArrowDown from 'lucide-svelte/icons/arrow-down';
	import FileUp from 'lucide-svelte/icons/file-up';
	import Sparkles from 'lucide-svelte/icons/sparkles';
	import { tick } from 'svelte';
	import { useWorkspaceUi } from '../workspace-ui-context';
	import ChatMessageByAssistant from './chat/chat-message-by-assistant.svelte';
	import ChatMessageByUser from './chat/chat-message-by-user.svelte';
	import MessageComposer from './chat/message-composer.svelte';
	import PendingAssistantMessage from './chat/pending-assistant-message.svelte';

	let { threadId }: { threadId: string } = $props();
	const workspaceUi = useWorkspaceUi();
	let sending = $state(false);
	let localError = $state('');
	let scrollableElement: HTMLElement | null = $state(null);
	let composer: { handleFiles: (files: FileList | File[]) => void } | null = $state(null);
	let shouldAutoScroll = $state(true);
	let showScrollDown = $state(false);
	let isDraggingFiles = $state(false);
	let dragDepth = 0;
	let thread = $derived(workspaceUi.getThread(threadId));
	let threadSummary = $derived(
		workspaceUi.threads.find((item) => item.id === threadId) ?? null
	);

	$effect(() => {
		if (threadSummary && !thread) void workspaceUi.openThread(threadId);
	});

	async function submitMessage(text: string, attachments: string[]) {
		if (sending) return;
		sending = true;
		shouldAutoScroll = true;
		localError = '';
		await tick();
		scrollToBottom();
		try {
			await workspaceUi.sendMessage(threadId, text, attachments);
		} catch (error) {
			localError = error instanceof Error ? error.message : 'Could not send the message.';
			throw error;
		} finally {
			sending = false;
		}
	}

	$effect(() => {
		const revision = [
			thread?.messages.length ?? 0,
			thread?.progress?.status ?? '',
			thread?.progress?.text ?? '',
			sending
		].join(':');
		if (!revision || !shouldAutoScroll) return;
		void tick().then(() => scrollToBottom());
	});

	function updateScrollState() {
		if (!scrollableElement) return;
		const distance =
			scrollableElement.scrollHeight
			- scrollableElement.scrollTop
			- scrollableElement.clientHeight;
		showScrollDown = distance > 40;
		shouldAutoScroll = distance <= 0;
	}

	function scrollToBottom(smooth = false) {
		if (!scrollableElement) return;
		scrollableElement.scrollTo({
			top: scrollableElement.scrollHeight,
			behavior: smooth ? 'smooth' : 'instant'
		});
		showScrollDown = false;
		shouldAutoScroll = true;
	}

	function dragHasFiles(event: DragEvent) {
		return Array.from(event.dataTransfer?.types ?? []).includes('Files');
	}
</script>

<section
	class="relative flex h-full min-w-0 flex-col overflow-hidden"
	aria-label="Chat"
	ondragenter={(event) => {
		if (!dragHasFiles(event)) return;
		event.preventDefault();
		dragDepth += 1;
		isDraggingFiles = true;
	}}
	ondragover={(event) => {
		if (dragHasFiles(event)) event.preventDefault();
	}}
	ondragleave={(event) => {
		if (!dragHasFiles(event)) return;
		event.preventDefault();
		dragDepth = Math.max(0, dragDepth - 1);
		if (dragDepth === 0) isDraggingFiles = false;
	}}
	ondrop={(event) => {
		if (!dragHasFiles(event)) return;
		event.preventDefault();
		dragDepth = 0;
		isDraggingFiles = false;
		const files = event.dataTransfer?.files;
		if (files?.length) composer?.handleFiles(files);
	}}
>
	{#if isDraggingFiles}
		<div
			class="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-surface-50/80 backdrop-blur-sm dark:bg-surface-950/80"
		>
			<div
				class="flex animate-pulse flex-col items-center gap-4 rounded-xl border-2 border-dashed border-primary-500 bg-surface-50 p-8 shadow-lg dark:bg-surface-900"
			>
				<FileUp size={48} class="text-primary-500" />
				<p class="text-xl font-medium">Drop files to attach</p>
			</div>
		</div>
	{/if}

	{#if workspaceUi.errorMessage || localError}
		<div class="mx-4 mt-4 rounded-lg bg-error-50-950 p-3 text-sm text-error-700-300" role="alert">
			{localError || workspaceUi.errorMessage}
		</div>
	{/if}

	{#if !thread}
		<div class="flex flex-1 items-center justify-center text-surface-500">Opening thread…</div>
	{:else}
		<div
			class="min-h-0 flex-1 overflow-y-auto pt-2 selectable-text"
			bind:this={scrollableElement}
			onscroll={updateScrollState}
		>
			<div class="mx-auto w-full max-w-4xl">
				{#if thread.messages.length === 0}
					<div class="flex min-h-[50vh] items-center justify-center">
						<div class="max-w-lg text-center">
							<div class="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary-100-900">
								<Sparkles size={22} />
							</div>
							<h2 class="mt-5 text-2xl font-semibold">Start this thread</h2>
							<p class="mt-2 text-surface-600-400">
								Ask Heswe to research, create, analyze, or handle work.
							</p>
						</div>
					</div>
				{/if}

				{#each thread.messages as message, index (`${message.id}-${index}`)}
					{#if message.role === 'user'}
						<ChatMessageByUser {message} {threadId} />
					{:else}
						<ChatMessageByAssistant {message} {threadId} />
					{/if}
				{/each}

				{#if thread.progress || sending}
					<PendingAssistantMessage progress={thread.progress} />
				{/if}
			</div>
		</div>

		{#if showScrollDown}
			<button
				type="button"
				class="btn-icon absolute bottom-20 left-1/2 z-10 -translate-x-1/2 rounded-full border border-surface-100-900 bg-surface-50-950 shadow"
				aria-label="Scroll to bottom"
				onclick={() => scrollToBottom(true)}
			>
				<ArrowDown size={18} />
			</button>
		{/if}

		<div class="min-h-min bg-surface-50-950">
			<div class="mx-auto max-w-4xl px-2 py-2">
				<MessageComposer
					{threadId}
					disabled={sending}
					bind:this={composer}
					onSend={submitMessage}
					onError={(message) => localError = message}
				/>
			</div>
		</div>
	{/if}
</section>
