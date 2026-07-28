<script lang="ts">
	import Command from 'lucide-svelte/icons/command';
	import LogOut from 'lucide-svelte/icons/log-out';
	import MessageSquarePlus from 'lucide-svelte/icons/message-square-plus';
	import Send from 'lucide-svelte/icons/send';
	import Sparkles from 'lucide-svelte/icons/sparkles';
	import {
		createWorkspace,
		createThread,
		getThread,
		getWorkspace,
		listWorkspaces,
		listThreads,
		selectWorkspace,
		sendMessage,
		subscribeToWorkspaceChanges,
		type ThreadDetail,
		type ThreadSummary,
		type WorkspaceSummary
	} from '../api-client';
	import { authClient } from '../auth-client';
	import CreateWorkspaceModal from './CreateWorkspaceModal.svelte';
	import WorkspaceSwitcher from './WorkspaceSwitcher.svelte';

	let { user }: { user: { id: string; name: string; email: string } } = $props();

	let currentWorkspaceId = $state<string | null>(null);
	let workspaces = $state<WorkspaceSummary[]>([]);
	let threads = $state<ThreadSummary[]>([]);
	let selectedThreadId = $state<string | null>(null);
	let thread = $state<ThreadDetail | null>(null);
	let draft = $state('');
	let loading = $state(true);
	let sending = $state(false);
	let switchingWorkspace = $state(false);
	let createWorkspaceOpen = $state(false);
	let errorMessage = $state('');
	let threadDetailRequest = 0;
	let threadListRequest = 0;
	let workspaceLoadRequest = 0;

	$effect(() => {
		void loadInitial();
	});

	$effect(() => {
		return subscribeToWorkspaceChanges((change) => {
			if (change.type === 'workspace.changed') {
				void loadInitial();
				return;
			}
			void refreshThreads();
			if (change.threadId === selectedThreadId) {
				void refreshSelectedThread();
			}
		});
	});

	async function loadInitial() {
		const request = ++workspaceLoadRequest;
		loading = true;
		errorMessage = '';
		try {
			const [workspace, loadedWorkspaces] = await Promise.all([
				getWorkspace(),
				listWorkspaces()
			]);
			if (request !== workspaceLoadRequest) return;

			const workspaceChanged = currentWorkspaceId !== workspace?.id;
			currentWorkspaceId = workspace?.id ?? null;
			workspaces = loadedWorkspaces;
			if (workspaceChanged) {
				clearThreadSelection();
			}

			if (!workspace) {
				threads = [];
				createWorkspaceOpen = loadedWorkspaces.length === 0;
				return;
			}

			const loadedThreads = await listThreads();
			if (request !== workspaceLoadRequest) return;
			threads = loadedThreads;
			if (threads.length > 0) {
				const selectedStillExists = selectedThreadId
					&& threads.some((item) => item.id === selectedThreadId);
				await selectThread(selectedStillExists ? selectedThreadId! : threads[0].id);
			} else {
				clearThreadSelection();
			}
		} catch (error) {
			if (request === workspaceLoadRequest) setError(error);
		} finally {
			if (request === workspaceLoadRequest) loading = false;
		}
	}

	function clearThreadSelection() {
		threadDetailRequest += 1;
		selectedThreadId = null;
		thread = null;
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
		if (!currentWorkspaceId) {
			createWorkspaceOpen = true;
			return;
		}
		try {
			const created = await createThread();
			threads = [created, ...threads.filter((thread) => thread.id !== created.id)];
			await selectThread(created.id);
		} catch (error) {
			setError(error);
		}
	}

	async function switchToWorkspace(workspaceId: string) {
		if (workspaceId === currentWorkspaceId || switchingWorkspace) return;
		switchingWorkspace = true;
		errorMessage = '';
		try {
			await selectWorkspace(workspaceId);
			clearThreadSelection();
			threads = [];
			await loadInitial();
		} catch (error) {
			setError(error);
		} finally {
			switchingWorkspace = false;
		}
	}

	async function addWorkspace(name: string) {
		errorMessage = '';
		await createWorkspace(name);
		createWorkspaceOpen = false;
		clearThreadSelection();
		threads = [];
		await loadInitial();
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

<main class="grid min-h-screen bg-surface-50-950 md:grid-cols-[18rem_1fr]">
	<aside class="flex min-h-0 flex-col border-r border-surface-200-800 bg-surface-100-900/50">
		<header class="flex h-16 items-center border-b border-surface-200-800 px-3">
			<div class="min-w-0 flex-1">
				<WorkspaceSwitcher
					{workspaces}
					{currentWorkspaceId}
					disabled={switchingWorkspace}
					onSelect={switchToWorkspace}
					onCreate={() => (createWorkspaceOpen = true)}
				/>
			</div>
		</header>

		<div class="flex items-center justify-between px-4 pb-3 pt-2">
			<h2 class="font-semibold">Threads</h2>
			<button
				class="rounded p-2 hover:preset-tonal disabled:opacity-40"
				type="button"
				onclick={addThread}
				aria-label="New thread"
				title="New thread"
				disabled={!currentWorkspaceId || switchingWorkspace}
			><MessageSquarePlus size={18} /></button>
		</div>

		<nav class="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-4" aria-label="Threads">
			{#each threads as item (item.id)}
				<button
					type="button"
					class={[
						'w-full rounded-xl px-3 py-3 text-left transition',
						selectedThreadId === item.id
							? 'bg-surface-200-800'
							: 'hover:bg-surface-100-900'
					]}
					onclick={() => void chooseThread(item.id)}
				>
					<span class="block truncate text-sm font-medium">{item.title}</span>
					<span class="mt-1 block truncate text-xs text-surface-500">{item.preview || 'No messages yet'}</span>
				</button>
			{/each}
			{#if !loading && currentWorkspaceId && threads.length === 0}
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
					class="rounded p-2 hover:preset-tonal"
					type="button"
					onclick={() => authClient.signOut()}
					aria-label="Sign out"
					title="Sign out"
				><LogOut size={18} /></button>
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
						onclick={() => (createWorkspaceOpen = true)}
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
					<button class="btn preset-filled-primary-500 mt-6" type="button" onclick={addThread}>
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

			<form class="bg-surface-50-950 p-4 pt-2" onsubmit={submitMessage}>
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
</main>

{#if createWorkspaceOpen}
	<CreateWorkspaceModal
		onCreate={addWorkspace}
		onClose={() => (createWorkspaceOpen = false)}
	/>
{/if}
