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

<div class="flex flex-col gap-3">
	<div class="h-[min(36rem,calc(100vh-17rem))] min-h-72">
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
	<div class="flex justify-end gap-2">
		<button type="button" class="btn preset-ghost" onclick={() => workspaceUi.swins.pop()}>
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
