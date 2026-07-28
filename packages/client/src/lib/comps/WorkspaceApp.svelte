<script lang="ts">
	import { WorkspaceController } from '../workspace-controller.svelte';
	import { setWorkspaceUiContext, type WorkspaceUser } from '../workspace-ui-context';
	import CreateWorkspaceModal from './CreateWorkspaceModal.svelte';
	import WorkspaceSettingsModal from './workspace-settings-modal.svelte';
	import WorkspaceTTabsLayout from './WorkspaceTTabsLayout.svelte';

	let { user }: { user: WorkspaceUser } = $props();
	const workspace = new WorkspaceController(() => user);
	setWorkspaceUiContext(workspace);

	$effect(() => {
		return workspace.start();
	});
</script>

<svelte:window onkeydown={(event) => workspace.handleShortcut(event)} />

<main class="h-screen overflow-hidden bg-surface-50-950">
	<WorkspaceTTabsLayout />
</main>

{#if workspace.createWorkspaceOpen}
	<CreateWorkspaceModal
		onCreate={workspace.createWorkspace}
		onClose={workspace.closeCreateWorkspace}
	/>
{/if}

{#if workspace.settingsOpen}
	<WorkspaceSettingsModal onClose={workspace.closeSettings} />
{/if}
