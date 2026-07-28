<script lang="ts">
	import ChevronsUpDown from 'lucide-svelte/icons/chevrons-up-down';
	import Plus from 'lucide-svelte/icons/plus';
	import type { WorkspaceSummary } from '../api-client';

	let {
		workspaces,
		currentWorkspaceId,
		disabled = false,
		onSelect,
		onCreate
	}: {
		workspaces: WorkspaceSummary[];
		currentWorkspaceId: string | null;
		disabled?: boolean;
		onSelect: (workspaceId: string) => void | Promise<void>;
		onCreate: () => void;
	} = $props();

	let open = $state(false);
	let currentWorkspace = $derived(
		workspaces.find((workspace) => workspace.id === currentWorkspaceId) ?? null
	);

	function chooseWorkspace(workspaceId: string) {
		open = false;
		if (workspaceId !== currentWorkspaceId) {
			void onSelect(workspaceId);
		}
	}

	function createWorkspace() {
		open = false;
		onCreate();
	}
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape') open = false;
	}}
/>

<div class="relative">
	<button
		type="button"
		class="flex h-full w-full items-center gap-2 rounded px-1 py-1 text-left hover:preset-tonal disabled:opacity-50"
		aria-label="Switch workspace"
		aria-expanded={open}
		aria-haspopup="dialog"
		disabled={disabled}
		onclick={() => (open = !open)}
	>
		<ChevronsUpDown size={18} class="shrink-0" />
		<span class="min-w-0 flex-1 truncate">
			{currentWorkspace?.name ?? 'Choose a workspace'}
		</span>
	</button>

	{#if open}
		<button
			type="button"
			class="fixed inset-0 z-20 cursor-default"
			aria-label="Close workspace menu"
			onclick={() => (open = false)}
		></button>
		<div
			class="absolute left-0 top-full z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] space-y-2 rounded-xl border border-surface-100-900 bg-surface-50-950 p-2 shadow-lg"
			role="dialog"
			aria-label="Workspaces"
		>
			<div class="flex max-h-72 flex-col gap-1 overflow-y-auto">
				{#each workspaces as workspace (workspace.id)}
					<button
						type="button"
						class={[
							'btn btn-sm w-full justify-start text-left',
							workspace.id === currentWorkspaceId
								? 'preset-filled-secondary-500'
								: 'preset-ghost'
						]}
						aria-label={`Switch to ${workspace.name}`}
						onclick={() => chooseWorkspace(workspace.id)}
					>
						<strong class="truncate">{workspace.name}</strong>
					</button>
				{/each}
				{#if workspaces.length === 0}
					<p class="px-3 py-4 text-center text-sm text-surface-500">
						No workspaces yet.
					</p>
				{/if}
			</div>

			<div class="border-t border-surface-200-800 pt-2">
				<button
					type="button"
					class="btn btn-sm w-full justify-start preset-ghost"
					onclick={createWorkspace}
				>
					<Plus size={16} />
					Create workspace
				</button>
			</div>
		</div>
	{/if}
</div>
