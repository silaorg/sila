<script lang="ts">
	import type { WorkspaceFsEntry } from '../../api-client';
	import FilesApp from '../../comps/files/FilesApp.svelte';
	import { useWorkspaceUi } from '../../workspace-ui-context';

	let {
		onPick
	}: {
		onPick: (files: Array<Extract<WorkspaceFsEntry, { type: 'file' }>>) => void;
	} = $props();

	const workspaceUi = useWorkspaceUi();
	let selectedFiles = $state<Array<Extract<WorkspaceFsEntry, { type: 'file' }>>>([]);

	function pickAndClose(files: Array<Extract<WorkspaceFsEntry, { type: 'file' }>>) {
		if (files.length === 0) return;
		onPick(files);
		workspaceUi.swins.pop();
	}
</script>

<div class="files-swin file-picker-swin">
	<div class="file-picker-body">
		<FilesApp
			onFileOpen={(file) => pickAndClose([file])}
			onSelectionChange={(entries) => {
				selectedFiles = entries.filter(
					(entry): entry is Extract<WorkspaceFsEntry, { type: 'file' }> =>
						entry.type === 'file'
				);
			}}
		/>
	</div>
	<div class="file-picker-footer">
		<button type="button" class="btn preset-outlined-surface-500" onclick={() => workspaceUi.swins.pop()}>
			Cancel
		</button>
		<button
			type="button"
			class="btn preset-filled-primary-500"
			disabled={selectedFiles.length === 0}
			onclick={() => pickAndClose(selectedFiles)}
		>
			Attach
		</button>
	</div>
</div>
