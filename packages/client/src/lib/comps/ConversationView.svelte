<script lang="ts">
	import Command from 'lucide-svelte/icons/command';
	import Send from 'lucide-svelte/icons/send';
	import Sparkles from 'lucide-svelte/icons/sparkles';
	import type { ThreadDetail } from '../api-client';

	let {
		thread,
		currentWorkspaceId,
		loading,
		sending,
		errorMessage,
		draft = $bindable(),
		onCreateWorkspace,
		onCreateThread,
		onSubmitMessage
	}: {
		thread: ThreadDetail | null;
		currentWorkspaceId: string | null;
		loading: boolean;
		sending: boolean;
		errorMessage: string;
		draft: string;
		onCreateWorkspace: () => void;
		onCreateThread: () => void | Promise<void>;
		onSubmitMessage: (event: SubmitEvent) => void | Promise<void>;
	} = $props();
</script>

<section class="flex min-h-screen min-w-0 flex-col">
	<header class="flex h-16 items-center border-b border-surface-200-800 bg-surface-50-950 px-6">
		<h1 class="truncate font-semibold">{thread?.title ?? 'Heswe'}</h1>
	</header>

	{#if errorMessage}
		<div class="m-4 rounded-lg bg-error-50-950 p-3 text-sm text-error-700-300" role="alert">
			{errorMessage}
		</div>
	{/if}

	{#if loading}
		<div class="flex flex-1 items-center justify-center text-surface-500">Connecting…</div>
	{:else if !currentWorkspaceId}
		<div class="flex flex-1 items-center justify-center p-8">
			<div class="max-w-md text-center">
				<div class="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary-100-900">
					<Command size={22} />
				</div>
				<h2 class="mt-5 text-2xl font-semibold">Create your first workspace</h2>
				<p class="mt-2 text-surface-600-400">
					Keep different teams, projects, or parts of your life in separate workspaces.
				</p>
				<button
					class="btn preset-filled-primary-500 mt-6"
					type="button"
					onclick={onCreateWorkspace}
				>
					Create workspace
				</button>
			</div>
		</div>
	{:else if !thread}
		<div class="flex flex-1 items-center justify-center p-8">
			<div class="max-w-md text-center">
				<div class="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary-100-900">
					<Sparkles size={22} />
				</div>
				<h2 class="mt-5 text-2xl font-semibold">Start a new thread</h2>
				<p class="mt-2 text-surface-600-400">
					Ask Heswe to research, create, analyze, or handle work for your team.
				</p>
				<button
					class="btn preset-filled-primary-500 mt-6"
					type="button"
					onclick={() => void onCreateThread()}
				>
					New thread
				</button>
			</div>
		</div>
	{:else}
		<div class="min-h-0 flex-1 overflow-y-auto">
			<div class="mx-auto flex max-w-3xl flex-col gap-5 px-5 py-8">
				{#each thread.messages as message, index (`${message.id}-${index}`)}
					{#if message.role === 'user'}
						<div class="ml-auto max-w-[85%] rounded-2xl bg-surface-100-900 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
							{message.text}
						</div>
					{:else}
						<div class="flex max-w-[85%] gap-3 px-1 py-2">
							<Sparkles size={20} class="mt-0.5 shrink-0" />
							<div class="min-w-0">
								<p class="mb-2 text-sm font-semibold">Heswe</p>
								<div class="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</div>
							</div>
						</div>
					{/if}
				{/each}
				{#if sending}
					<div class="flex max-w-[85%] gap-3 px-1 py-2 text-surface-500">
						<Sparkles size={20} class="mt-0.5 shrink-0" />
						<div class="text-sm">Heswe is working…</div>
					</div>
				{/if}
			</div>
		</div>

		<form class="bg-surface-50-950 p-4 pt-2" onsubmit={onSubmitMessage}>
			<div class="mx-auto flex max-w-3xl items-end gap-2 rounded-xl border border-surface-300-700 p-2">
				<textarea
					class="min-h-12 flex-1 resize-none border-0 bg-transparent px-2 py-2 focus:ring-0"
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
					class="flex size-10 shrink-0 items-center justify-center rounded-full text-primary-500 hover:preset-tonal disabled:text-surface-400-600"
					type="submit"
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
