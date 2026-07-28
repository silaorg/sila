<script lang="ts">
	import Send from 'lucide-svelte/icons/send';
	import Sparkles from 'lucide-svelte/icons/sparkles';
	import { useWorkspaceUi } from '../workspace-ui-context';

	let { threadId }: { threadId: string } = $props();
	const workspaceUi = useWorkspaceUi();
	let draft = $state('');
	let sending = $state(false);
	let localError = $state('');
	let thread = $derived(workspaceUi.getThread(threadId));
	let threadSummary = $derived(
		workspaceUi.threads.find((item) => item.id === threadId) ?? null
	);

	$effect(() => {
		if (threadSummary && !thread) void workspaceUi.openThread(threadId);
	});

	async function submitMessage(event: SubmitEvent) {
		event.preventDefault();
		const text = draft.trim();
		if (!text || sending) return;
		draft = '';
		sending = true;
		localError = '';
		try {
			await workspaceUi.sendMessage(threadId, text);
		} catch (error) {
			draft = text;
			localError = error instanceof Error ? error.message : 'Could not send the message.';
		} finally {
			sending = false;
		}
	}
</script>

<section class="relative flex h-full min-w-0 flex-col overflow-hidden">
	{#if workspaceUi.errorMessage || localError}
		<div class="mx-4 mt-4 rounded-lg bg-error-50-950 p-3 text-sm text-error-700-300" role="alert">
			{localError || workspaceUi.errorMessage}
		</div>
	{/if}

	{#if !thread}
		<div class="flex flex-1 items-center justify-center text-surface-500">Opening thread…</div>
	{:else}
		<div class="min-h-0 flex-1 overflow-y-auto selectable-text">
			<div class="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
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
						<div class="ml-auto max-w-[85%] rounded-2xl bg-surface-100-900 px-4 py-3 text-sm leading-6 whitespace-pre-wrap">
							{message.text}
						</div>
					{:else}
						<div class="flex max-w-[90%] gap-3 px-1 py-2">
							<div class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary-100-900">
								<Sparkles size={16} />
							</div>
							<div class="min-w-0">
								<p class="mb-1.5 text-sm font-semibold">Heswe</p>
								<div class="text-sm leading-6 whitespace-pre-wrap">{message.text}</div>
							</div>
						</div>
					{/if}
				{/each}

				{#if sending}
					<div class="flex max-w-[90%] gap-3 px-1 py-2 text-surface-500">
						<div class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary-100-900">
							<Sparkles size={16} />
						</div>
						<div class="text-sm">Heswe is working…</div>
					</div>
				{/if}
			</div>
		</div>

		<form class="bg-surface-50-950 px-4 pb-5 pt-2" onsubmit={submitMessage}>
			<div class="mx-auto flex max-w-3xl items-end gap-2 rounded-xl border border-surface-300-700 bg-surface-50-950 p-2 shadow-sm focus-within:border-primary-500">
				<textarea
					class="min-h-12 flex-1 resize-none border-0 bg-transparent px-2 py-2 outline-none focus:ring-0"
					rows="1"
					bind:value={draft}
					placeholder="Message Heswe…"
					disabled={sending}
					onkeydown={(event) => {
						if (event.key === 'Enter' && !event.shiftKey) {
							event.preventDefault();
							event.currentTarget.form?.requestSubmit();
						}
					}}
				></textarea>
				<button
					type="submit"
					class="flex size-10 shrink-0 items-center justify-center rounded-full text-primary-500 hover:preset-tonal disabled:text-surface-400-600"
					disabled={sending || !draft.trim()}
					aria-label="Send"
					title="Send"
				>
					<Send size={20} />
				</button>
			</div>
		</form>
	{/if}
</section>
