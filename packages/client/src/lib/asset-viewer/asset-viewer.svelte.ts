import type { WorkspaceFsEntry } from '../api-client';

export type WorkspaceFileEntry = Extract<WorkspaceFsEntry, { type: 'file' }>;

export class AssetViewer {
	activeFile = $state<WorkspaceFileEntry | null>(null);

	open(file: WorkspaceFileEntry) {
		this.activeFile = file;
	}

	close() {
		this.activeFile = null;
	}
}
