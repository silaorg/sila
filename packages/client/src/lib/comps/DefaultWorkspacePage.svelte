<script lang="ts">
	import Command from 'lucide-svelte/icons/command';
	import Sparkles from 'lucide-svelte/icons/sparkles';
	import { useWorkspaceUi } from '../workspace-ui-context';
	import SidebarToggle from './SidebarToggle.svelte';

	const workspaceUi = useWorkspaceUi();
</script>

<div class="relative flex h-full w-full flex-col items-center justify-center">
	{#if !workspaceUi.layout.sidebar.isOpen}
		<div class="absolute left-2 top-2">
			<SidebarToggle />
		</div>
	{/if}

	<div class="w-full max-w-screen-md px-6 text-center">
		{#if workspaceUi.loading}
			<p class="text-surface-500">Connecting…</p>
		{:else if !workspaceUi.currentWorkspaceId}
			<div class="card mx-auto max-w-xl p-8">
				<div class="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary-100-900">
					<Command size={22} />
				</div>
				<h2 class="mt-5 text-2xl font-semibold">Create your first workspace</h2>
				<p class="mt-2 text-surface-600-400">
					A workspace keeps conversations, files, and agents together for a team, project, or
					part of your life.
				</p>
				<button
					type="button"
					class="btn preset-filled-primary-500 mt-6"
					onclick={workspaceUi.openCreateWorkspace}
				>
					Create workspace
				</button>
			</div>
		{:else}
			<div class="mx-auto max-w-xl">
				<div class="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary-100-900">
					<Sparkles size={22} />
				</div>
				<h2 class="mt-5 text-2xl font-semibold">What do you want to work on?</h2>
				<p class="mt-2 text-surface-600-400">
					Start a conversation with an agent. You can keep several threads open in tabs.
				</p>
				<button
					type="button"
					class="btn preset-filled-primary-500 mt-6"
					onclick={() => void workspaceUi.createThread()}
				>
					New thread
				</button>
			</div>
		{/if}
	</div>
</div>
