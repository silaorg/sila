import type { WorkspaceFsEntry } from '../api-client';

export type WorkspaceFileEntry = Extract<WorkspaceFsEntry, { type: 'file' }>;

/** File-preview state adapted from Sila's VertexViewer. */
export class AssetViewer {
	files = $state<WorkspaceFileEntry[]>([]);
	activeFileIndex = $state(0);

	get activeFile() {
		return this.files[this.activeFileIndex];
	}

	open(file: WorkspaceFileEntry) {
		this.files = [file];
		this.activeFileIndex = 0;
	}

	openFiles(files: WorkspaceFileEntry[], activeFileIndex = 0) {
		if (files.length === 0) return;
		this.files = files;
		this.activeFileIndex = Math.max(0, Math.min(files.length - 1, activeFileIndex));
	}

	close() {
		this.files = [];
		this.activeFileIndex = 0;
	}
}
