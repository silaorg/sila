import type { WorkspaceFsEntry } from '../api-client';

export type WorkspaceFileEntry = Extract<WorkspaceFsEntry, { type: 'file' }>;

export function getPreviewType(mimeType: string) {
	if (mimeType.startsWith('image/')) return 'image';
	if (mimeType.startsWith('video/')) return 'video';
	if (mimeType.startsWith('audio/')) return 'audio';
	if (mimeType === 'application/pdf') return 'pdf';
	if (mimeType.startsWith('text/') || mimeType === 'application/json') return 'text';
	return 'download';
}

export class AssetViewer {
	activeFile = $state<WorkspaceFileEntry | null>(null);

	open(file: WorkspaceFileEntry) {
		this.activeFile = file;
	}

	close() {
		this.activeFile = null;
	}
}
