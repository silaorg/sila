<script lang="ts">
	import {
		createThread,
		getThread,
		getWorkspace,
		listThreads,
		sendMessage,
		subscribeToWorkspaceChanges,
		type ThreadDetail,
		type ThreadSummary
	} from '../api-client';
	import { authClient } from '../auth-client';

	let { user }: { user: { id: string; name: string; email: string } } = $props();

	let workspaceName = $state('Workspace');
	let threads = $state<ThreadSummary[]>([]);
	let selectedThreadId = $state<string | null>(null);
	let thread = $state<ThreadDetail | null>(null);
	let draft = $state('');
	let loading = $state(true);
	let sending = $state(false);
	let errorMessage = $state('');
	let threadDetailRequest = 0;
	let threadListRequest = 0;

	$effect(() => {
		void loadInitial();
	});

	$effect(() => {
		return subscribeToWorkspaceChanges((change) => {
			void refreshThreads();
			if (change.threadId === selectedThreadId) {
				void refreshSelectedThread();
			}
		});
	});

	async function loadInitial() {
		loading = true;
		errorMessage = '';
		try {
			const [workspace, loadedThreads] = await Promise.all([getWorkspace(), listThreads()]);
			workspaceName = workspace.name;
			threads = loadedThreads;
			if (threads.length > 0) {
				await selectThread(selectedThreadId ?? threads[0].id);
			}
		} catch (error) {
			setError(error);
		} finally {
			loading = false;
		}
	}

	async function refreshThreads() {
		const request = ++threadListRequest;
		try {
			const loaded = await listThreads();
			if (request === threadListRequest) {
				threads = loaded;
			}
		} catch (error) {
			if (request === threadListRequest) {
				setError(error);
			}
		}
	}

	async function refreshSelectedThread() {
		const threadId = selectedThreadId;
		if (!threadId) return;
		const request = ++threadDetailRequest;
		try {
			const loaded = await getThread(threadId);
			if (request === threadDetailRequest && selectedThreadId === threadId) {
				thread = loaded;
			}
		} catch (error) {
			if (request === threadDetailRequest) {
				setError(error);
			}
		}
	}

	async function selectThread(threadId: string) {
		const request = ++threadDetailRequest;
		selectedThreadId = threadId;
		try {
			const loaded = await getThread(threadId);
			if (request === threadDetailRequest && selectedThreadId === threadId) {
				thread = loaded;
			}
		} catch (error) {
			if (request === threadDetailRequest) {
				setError(error);
			}
			throw error;
		}
	}

	async function chooseThread(threadId: string) {
		try {
			await selectThread(threadId);
		} catch {}
	}

	async function addThread() {
		try {
			const created = await createThread();
			threads = [created, ...threads.filter((thread) => thread.id !== created.id)];
			await selectThread(created.id);
		} catch (error) {
			setError(error);
		}
	}

	async function submitMessage(event: SubmitEvent) {
		event.preventDefault();
		const text = draft.trim();
		if (!text || !selectedThreadId || sending) return;
		draft = '';
		sending = true;
		errorMessage = '';
		try {
			await sendMessage(selectedThreadId, text);
			await Promise.all([refreshThreads(), refreshSelectedThread()]);
		} catch (error) {
			draft = text;
			setError(error);
		} finally {
			sending = false;
		}
	}

	function setError(error: unknown) {
		errorMessage = error instanceof Error ? error.message : 'Something went wrong.';
	}

</script>

<main class="grid min-h-screen bg-surface-100-900 md:grid-cols-[18rem_1fr]">
	<aside class="flex min-h-0 flex-col border-r border-surface-200-800 bg-surface-50-950">
		<header class="flex h-16 items-center justify-between border-b border-surface-200-800 px-5">
			<a href="https://heswe.com" class="text-lg font-semibold tracking-tight">heswe</a>
			<span class="rounded-full bg-success-100-900 px-2 py-1 text-xs text-success-700-300">
				Live
			</span>
		</header>

		<div class="flex items-center justify-between px-4 pb-3 pt-5">
			<div>
				<p class="text-xs font-semibold uppercase tracking-wider text-surface-500">{workspaceName}</p>
				<h2 class="mt-1 font-semibold">Threads</h2>
			</div>
			<button
				class="btn-icon preset-filled-primary-500"
				type="button"
				onclick={addThread}
				aria-label="New thread"
				title="New thread"
			>+</button>
		</div>

		<nav class="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-4" aria-label="Threads">
			{#each threads as item (item.id)}
				<button
					type="button"
					class={[
						'w-full rounded-xl px-3 py-3 text-left transition',
						selectedThreadId === item.id
							? 'bg-primary-100-900 text-primary-950-50'
							: 'hover:bg-surface-100-900'
					]}
					onclick={() => void chooseThread(item.id)}
				>
					<span class="block truncate text-sm font-medium">{item.title}</span>
					<span class="mt-1 block truncate text-xs text-surface-500">{item.preview || 'No messages yet'}</span>
				</button>
			{/each}
			{#if !loading && threads.length === 0}
				<p class="px-3 py-6 text-sm text-surface-500">Create a thread to get started.</p>
			{/if}
		</nav>

		<footer class="border-t border-surface-200-800 p-4">
			<div class="flex items-center gap-3">
				<div class="flex size-9 items-center justify-center rounded-full bg-primary-100-900 font-semibold">
					{user.name.slice(0, 1).toUpperCase()}
				</div>
				<div class="min-w-0 flex-1">
					<p class="truncate text-sm font-medium">{user.name}</p>
					<p class="truncate text-xs text-surface-500">{user.email}</p>
				</div>
				<button
					class="btn-icon preset-tonal"
					type="button"
					onclick={() => authClient.signOut()}
					aria-label="Sign out"
					title="Sign out"
				>↗</button>
			</div>
		</footer>
	</aside>

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
		{:else if !thread}
			<div class="flex flex-1 items-center justify-center p-8">
				<div class="max-w-md text-center">
					<div class="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary-100-900 text-xl">✦</div>
					<h2 class="mt-5 text-2xl font-semibold">Start a new thread</h2>
					<p class="mt-2 text-surface-600-400">
						Ask Heswe to research, create, analyze, or handle work for your team.
					</p>
					<button class="btn preset-filled-primary-500 mt-6" type="button" onclick={addThread}>
						New thread
					</button>
				</div>
			</div>
		{:else}
			<div class="min-h-0 flex-1 overflow-y-auto">
				<div class="mx-auto flex max-w-3xl flex-col gap-5 px-5 py-8">
					{#each thread.messages as message, index (`${message.id}-${index}`)}
						<div class:ml-auto={message.role === 'user'} class="max-w-[85%]">
							<div
								class={[
									'rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap',
									message.role === 'user'
										? 'rounded-br-md bg-primary-500 text-white'
										: 'rounded-bl-md border border-surface-200-800 bg-surface-50-950'
								]}
							>{message.text}</div>
						</div>
					{/each}
					{#if sending}
						<div class="max-w-[85%]">
							<div class="rounded-2xl rounded-bl-md border border-surface-200-800 bg-surface-50-950 px-4 py-3 text-sm text-surface-500">
								Heswe is working…
							</div>
						</div>
					{/if}
				</div>
			</div>

			<form class="border-t border-surface-200-800 bg-surface-50-950 p-4" onsubmit={submitMessage}>
				<div class="mx-auto flex max-w-3xl items-end gap-3">
					<textarea
						class="textarea min-h-12 flex-1 resize-none"
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
						class="btn preset-filled-primary-500"
						type="submit"
						disabled={sending || !draft.trim()}
					>
						Send
					</button>
				</div>
			</form>
		{/if}
	</section>
</main>
