<script lang="ts">
	import { WorkspaceController } from '../workspace-controller.svelte';
	import { setWorkspaceUiContext, type WorkspaceUser } from '../workspace-ui-context';
	import AssetViewerModal from '../asset-viewer/asset-viewer-modal.svelte';
	import SwinsContainer from '../swins/swins-container.svelte';
	import WorkspaceSidebar from './WorkspaceSidebar.svelte';
	import WorkspaceTTabsLayout from './WorkspaceTTabsLayout.svelte';

	let { user }: { user: WorkspaceUser } = $props();
	const workspace = new WorkspaceController(() => user);
	setWorkspaceUiContext(workspace);

	$effect(() => {
		return workspace.start();
	});

	$effect(() => {
		const media = window.matchMedia('(max-width: 639px)');
		const update = () => workspace.layout.setCompact(media.matches);
		update();
		media.addEventListener('change', update);
		return () => media.removeEventListener('change', update);
	});
</script>

<svelte:window onkeydown={(event) => workspace.handleShortcut(event)} />

<main class="h-dvh overflow-hidden bg-surface-50-950">
	<WorkspaceTTabsLayout />
</main>

{#if workspace.layout.compact && workspace.layout.sidebar.isOpen}
	<button
		type="button"
		class="fixed inset-0 z-30 bg-surface-950/50"
		aria-label="Close sidebar"
		onclick={() => workspace.layout.closeMobileSidebar()}
	></button>
	<aside class="fixed inset-y-0 left-0 z-40 w-[min(300px,85vw)] border-r border-surface-200-800 bg-surface-50-950">
		<WorkspaceSidebar overlay />
	</aside>
{/if}

<SwinsContainer />
<AssetViewerModal />
