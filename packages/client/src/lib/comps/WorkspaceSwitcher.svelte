<script lang="ts">
	import Check from 'lucide-svelte/icons/check';
	import ChevronsUpDown from 'lucide-svelte/icons/chevrons-up-down';
	import Plus from 'lucide-svelte/icons/plus';
	import { useWorkspaceUi } from '../workspace-ui-context';

	const workspaceUi = useWorkspaceUi();
	let openState = $state(false);
	let currentWorkspace = $derived(
		workspaceUi.workspaces.find(
			(workspace) => workspace.id === workspaceUi.currentWorkspaceId
		) ?? null
	);

	function chooseWorkspace(workspaceId: string) {
		openState = false;
		if (workspaceId !== workspaceUi.currentWorkspaceId) {
			void workspaceUi.selectWorkspace(workspaceId);
		}
	}
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape') openState = false;
	}}
/>

<div class="relative">
	<button
		type="button"
		class="flex h-full w-full items-center gap-2 rounded px-1 py-1 text-left hover:preset-tonal disabled:opacity-50"
		aria-label="Switch workspace"
		aria-expanded={openState}
		aria-haspopup="dialog"
		disabled={workspaceUi.switchingWorkspace}
		onclick={() => (openState = !openState)}
	>
		<ChevronsUpDown size={18} class="shrink-0" />
		<span class="min-w-0 flex-1 truncate">
			{currentWorkspace?.name ?? 'Choose a workspace'}
		</span>
	</button>

	{#if openState}
		<button
			type="button"
			class="fixed inset-0 z-20 cursor-default"
			aria-label="Close workspace menu"
			onclick={() => (openState = false)}
		></button>
		<div
			class="absolute left-0 top-full z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-surface-100-900 bg-surface-50-950 p-2 shadow-lg"
			role="dialog"
			aria-label="Workspaces"
		>
			<div class="flex max-h-72 flex-col gap-1 overflow-y-auto">
				{#each workspaceUi.workspaces as workspace (workspace.id)}
					<button
						type="button"
						class={[
							'btn btn-sm w-full justify-start text-left',
							workspace.id === workspaceUi.currentWorkspaceId
								? 'preset-filled-secondary-500'
								: 'preset-ghost'
						]}
						aria-label={`Switch to ${workspace.name}`}
						onclick={() => chooseWorkspace(workspace.id)}
					>
						<strong class="min-w-0 flex-1 truncate">{workspace.name}</strong>
						{#if workspace.id === workspaceUi.currentWorkspaceId}
							<Check size={15} class="shrink-0" />
						{/if}
					</button>
				{/each}
				{#if workspaceUi.workspaces.length === 0}
					<p class="px-3 py-4 text-center text-sm text-surface-500">No workspaces yet.</p>
				{/if}
			</div>

			<div class="mt-4 border-t border-surface-200-800 pt-2">
				<button
					type="button"
					class="btn btn-sm w-full justify-start preset-ghost"
					onclick={() => {
						openState = false;
						workspaceUi.openCreateWorkspace();
					}}
				>
					<Plus size={16} />
					Create workspace
				</button>
			</div>
		</div>
	{/if}
</div>
