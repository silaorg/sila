<script lang="ts">
	import { WorkspaceController } from '../workspace-controller.svelte';
	import { setWorkspaceUiContext, type WorkspaceUser } from '../workspace-ui-context';
	import AssetViewerModal from '../asset-viewer/asset-viewer-modal.svelte';
	import SwinsContainer from '../swins/swins-container.svelte';
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

<SwinsContainer />
<AssetViewerModal />
