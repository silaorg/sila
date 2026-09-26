import { getContext, setContext } from 'svelte';
import type {
	ThreadDetail,
	ThreadSummary,
	WorkspaceFile,
	WorkspaceFsEntry,
	WorkspaceSummary
} from './api-client';
import type { WorkspaceLayout } from './workspace-layout.svelte';
import type { Swins } from './swins/swins.svelte';
import type { AssetViewer } from './asset-viewer/asset-viewer.svelte';

const WORKSPACE_UI_CONTEXT = Symbol('heswe-workspace-ui');

export type WorkspaceUser = {
	id: string;
	name: string;
	email: string;
};

export type WorkspaceUiContext = {
	readonly user: WorkspaceUser;
	readonly workspaces: WorkspaceSummary[];
	readonly currentWorkspaceId: string | null;
	readonly threads: ThreadSummary[];
	readonly loading: boolean;
	readonly switchingWorkspace: boolean;
	readonly filesystemVersion: number;
	readonly errorMessage: string;
	readonly layout: WorkspaceLayout;
	readonly swins: Swins;
	readonly assetViewer: AssetViewer;
	selectWorkspace: (workspaceId: string) => Promise<void>;
	openCreateWorkspace: () => void;
	createWorkspace: (name: string) => Promise<void>;
	openSettings: () => void;
	openThread: (threadId: string) => Promise<void>;
	createThread: (targetPanelId?: string) => Promise<void>;
	openFiles: () => void;
	openWorkspaceFile: (entry: Extract<WorkspaceFsEntry, { type: 'file' }>) => void;
	openWorkspaceFileInTab: (entry: Extract<WorkspaceFsEntry, { type: 'file' }>) => void;
	getThread: (threadId: string) => ThreadDetail | null;
	listFiles: (threadId: string, query?: string) => Promise<WorkspaceFile[]>;
	uploadFiles: (threadId: string, files: File[]) => Promise<WorkspaceFile[]>;
	removeUploadedFile: (threadId: string, reference: string) => Promise<void>;
	getFileUrl: (threadId: string, reference: string) => string;
	listWorkspaceDirectory: (path?: string) => Promise<WorkspaceFsEntry[]>;
	uploadWorkspaceFiles: (path: string, files: File[]) => Promise<WorkspaceFsEntry[]>;
	createWorkspaceDirectory: (path: string, name: string) => Promise<WorkspaceFsEntry>;
	renameWorkspaceEntry: (path: string, name: string) => Promise<WorkspaceFsEntry>;
	moveWorkspaceEntries: (
		paths: string[],
		destinationPath: string
	) => Promise<WorkspaceFsEntry[]>;
	removeWorkspaceEntry: (path: string) => Promise<void>;
	getWorkspaceAssetUrl: (path: string) => string;
	sendMessage: (
		threadId: string,
		text: string,
		attachments?: string[]
	) => Promise<void>;
	signOut: () => Promise<void>;
};

export function setWorkspaceUiContext(context: WorkspaceUiContext) {
	setContext(WORKSPACE_UI_CONTEXT, context);
	return context;
}

export function useWorkspaceUi() {
	const context = getContext<WorkspaceUiContext>(WORKSPACE_UI_CONTEXT);
	if (!context) {
		throw new Error('Workspace UI context is unavailable.');
	}
	return context;
}
