<script lang="ts">
	import { useWorkspaceUi } from '../../workspace-ui-context';
	import FilesApp from '../../comps/files/FilesApp.svelte';

	const workspaceUi = useWorkspaceUi();
</script>

<div class="h-[min(40rem,calc(100vh-13rem))] min-h-80">
	<FilesApp
		onFileOpen={(entry) => {
			workspaceUi.openWorkspaceFile(entry);
		}}
	/>
</div>
