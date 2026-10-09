<script lang="ts">
	import { useWorkspaceUi } from '../../workspace-ui-context';
	import FilesApp from '../../comps/files/FilesApp.svelte';

	const workspaceUi = useWorkspaceUi();
</script>

<div class="files-swin">
	<FilesApp
		onFileOpen={(entry) => {
			workspaceUi.openWorkspaceFile(entry);
		}}
	/>
</div>
