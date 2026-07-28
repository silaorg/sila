<script lang="ts">
	import LogOut from 'lucide-svelte/icons/log-out';
	import MessageSquarePlus from 'lucide-svelte/icons/message-square-plus';
	import type { ThreadSummary, WorkspaceSummary } from '../api-client';
	import WorkspaceSwitcher from './WorkspaceSwitcher.svelte';

	let {
		user,
		workspaces,
		currentWorkspaceId,
		threads,
		selectedThreadId,
		loading,
		switchingWorkspace,
		onSelectWorkspace,
		onCreateWorkspace,
		onSelectThread,
		onCreateThread,
		onSignOut
	}: {
		user: { name: string; email: string };
		workspaces: WorkspaceSummary[];
		currentWorkspaceId: string | null;
		threads: ThreadSummary[];
		selectedThreadId: string | null;
		loading: boolean;
		switchingWorkspace: boolean;
		onSelectWorkspace: (workspaceId: string) => void | Promise<void>;
		onCreateWorkspace: () => void;
		onSelectThread: (threadId: string) => void | Promise<void>;
		onCreateThread: () => void | Promise<void>;
		onSignOut: () => void | Promise<void>;
	} = $props();

	const avatarLabel = $derived((user.name || user.email).slice(0, 1).toUpperCase());
</script>

<aside class="flex min-h-0 flex-col border-r border-surface-200-800 bg-surface-100-900/50">
	<header class="flex h-16 items-center border-b border-surface-200-800 px-3">
		<div class="min-w-0 flex-1">
			<WorkspaceSwitcher
				{workspaces}
				{currentWorkspaceId}
				disabled={switchingWorkspace}
				onSelect={onSelectWorkspace}
				onCreate={onCreateWorkspace}
			/>
		</div>
	</header>

	<div class="flex items-center justify-between px-4 pb-3 pt-2">
		<h2 class="font-semibold">Threads</h2>
		<button
			class="rounded p-2 hover:preset-tonal disabled:opacity-40"
			type="button"
			onclick={() => void onCreateThread()}
			aria-label="New thread"
			title="New thread"
			disabled={!currentWorkspaceId || switchingWorkspace}
		><MessageSquarePlus size={18} /></button>
	</div>

	<nav class="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-4" aria-label="Threads">
		{#each threads as thread (thread.id)}
			<button
				type="button"
				class={[
					'w-full rounded-xl px-3 py-3 text-left transition',
					selectedThreadId === thread.id
						? 'bg-surface-200-800'
						: 'hover:bg-surface-100-900'
				]}
				onclick={() => void onSelectThread(thread.id)}
			>
				<span class="block truncate text-sm font-medium">{thread.title}</span>
				<span class="mt-1 block truncate text-xs text-surface-500">
					{thread.preview || 'No messages yet'}
				</span>
			</button>
		{/each}
		{#if !loading && currentWorkspaceId && threads.length === 0}
			<p class="px-3 py-6 text-sm text-surface-500">Create a thread to get started.</p>
		{/if}
	</nav>

	<footer class="border-t border-surface-200-800 p-4">
		<div class="flex items-center gap-3">
			<div class="flex size-9 items-center justify-center rounded-full bg-primary-100-900 font-semibold">
				{avatarLabel}
			</div>
			<div class="min-w-0 flex-1">
				<p class="truncate text-sm font-medium">{user.name}</p>
				<p class="truncate text-xs text-surface-500">{user.email}</p>
			</div>
			<button
				class="rounded p-2 hover:preset-tonal"
				type="button"
				onclick={() => void onSignOut()}
				aria-label="Sign out"
				title="Sign out"
			><LogOut size={18} /></button>
		</div>
	</footer>
</aside>
