<script lang="ts">
	import FolderOpen from 'lucide-svelte/icons/folder-open';
	import LogOut from 'lucide-svelte/icons/log-out';
	import SquarePen from 'lucide-svelte/icons/square-pen';
	import { useWorkspaceUi } from '../workspace-ui-context';
	import SidebarToggle from './SidebarToggle.svelte';
	import WorkspaceSettingsButton from './WorkspaceSettingsButton.svelte';
	import WorkspaceSwitcher from './WorkspaceSwitcher.svelte';

	const workspaceUi = useWorkspaceUi();
	const avatarLabel = $derived(
		(workspaceUi.user.name || workspaceUi.user.email).slice(0, 1).toUpperCase()
	);
</script>

<div
	class="flex h-full flex-col overflow-hidden bg-surface-100-900/50"
	class:hidden={!workspaceUi.layout.sidebar.isOpen}
	data-testid="sidebar"
>
	<div class="min-h-min px-2 py-2">
		<div class="flex w-full items-center pb-3">
			<div class="min-w-0 flex-1">
				<WorkspaceSwitcher />
			</div>
			<div class="flex items-center">
				<WorkspaceSettingsButton />
				<SidebarToggle />
			</div>
		</div>

		<button
			type="button"
			class="flex w-full items-center gap-2 rounded px-1 py-1 text-left hover:preset-tonal disabled:opacity-40"
			disabled={!workspaceUi.currentWorkspaceId || workspaceUi.switchingWorkspace}
			onclick={() => void workspaceUi.createThread()}
		>
			<span class="flex h-6 w-6 shrink-0 items-center justify-center">
				<SquarePen size={18} />
			</span>
			<span class="min-w-0 flex-1 truncate text-sm">New thread</span>
			<span class="pr-1 text-[11px] text-surface-500">⌘T</span>
		</button>
		<button
			type="button"
			class="mt-1 flex w-full items-center gap-2 rounded px-1 py-1 text-left hover:preset-tonal disabled:opacity-40"
			disabled={!workspaceUi.currentWorkspaceId || workspaceUi.switchingWorkspace}
			onclick={workspaceUi.openFiles}
		>
			<span class="flex h-6 w-6 shrink-0 items-center justify-center">
				<FolderOpen size={18} />
			</span>
			<span class="min-w-0 flex-1 truncate text-sm">Files</span>
		</button>
	</div>

	<div class="px-3 pb-2 pt-2">
		<h2 class="text-xs font-semibold uppercase tracking-wide text-surface-500">Threads</h2>
	</div>

	<div class="min-h-0 flex-1 overflow-y-auto px-2">
		<ul class="space-y-1">
			{#each workspaceUi.threads as thread (thread.id)}
				<li class="relative">
					<button
						type="button"
						class="w-full truncate rounded px-2 py-1.5 text-left text-sm hover:preset-tonal"
						title={thread.title}
						onclick={() => void workspaceUi.openThread(thread.id)}
					>
						{thread.title}
					</button>
				</li>
			{/each}
		</ul>

		{#if !workspaceUi.loading && workspaceUi.currentWorkspaceId && workspaceUi.threads.length === 0}
			<p class="px-2 py-5 text-sm text-surface-500">Create a thread to get started.</p>
		{/if}
	</div>

	<div class="border-t border-surface-200-800 p-3">
		<div class="flex items-center gap-3">
			<div class="flex size-8 items-center justify-center rounded-full bg-primary-100-900 text-sm font-semibold">
				{avatarLabel}
			</div>
			<div class="min-w-0 flex-1">
				<p class="truncate text-sm font-medium">
					{workspaceUi.user.name || workspaceUi.user.email}
				</p>
				<p class="truncate text-[11px] text-surface-500">{workspaceUi.user.email}</p>
			</div>
			<button
				type="button"
				class="rounded p-2 hover:preset-tonal"
				aria-label="Sign out"
				title="Sign out"
				onclick={() => void workspaceUi.signOut()}
			>
				<LogOut size={18} />
			</button>
		</div>
	</div>
</div>
