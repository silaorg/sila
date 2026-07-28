import {
	createWorkspaceDirectory as createWorkspaceDirectoryRequest,
	createThread as createThreadRequest,
	createWorkspace as createWorkspaceRequest,
	getThread as getThreadRequest,
	getWorkspaceAssetUrl,
	getWorkspaceFileUrl,
	listWorkspaceDirectory,
	listThreads,
	listWorkspaceFiles,
	listWorkspaces,
	moveWorkspaceEntries as moveWorkspaceEntriesRequest,
	removeWorkspaceEntry as removeWorkspaceEntryRequest,
	removeThreadFile,
	renameWorkspaceEntry as renameWorkspaceEntryRequest,
	selectWorkspace as selectWorkspaceRequest,
	sendMessage as sendMessageRequest,
	subscribeToWorkspaceChanges,
	uploadThreadFiles,
	uploadWorkspaceFiles as uploadWorkspaceFilesRequest,
	type ThreadDetail,
	type ThreadSummary,
	type WorkspaceChange,
	type WorkspaceFile,
	type WorkspaceFsEntry,
	type WorkspaceSummary
} from './api-client';
import { authClient } from './auth-client';
import { AssetViewer } from './asset-viewer/asset-viewer.svelte';
import { WorkspaceLayout } from './workspace-layout.svelte';
import { setupSwins, swinsLayout } from './swins/swins-layout';
import type { WorkspaceUiContext, WorkspaceUser } from './workspace-ui-context';

export class WorkspaceController implements WorkspaceUiContext {
	readonly layout = new WorkspaceLayout();
	readonly swins = setupSwins();
	readonly assetViewer = new AssetViewer();

	currentWorkspaceId = $state<string | null>(null);
	workspaces = $state<WorkspaceSummary[]>([]);
	threads = $state<ThreadSummary[]>([]);
	loading = $state(true);
	switchingWorkspace = $state(false);
	filesystemVersion = $state(0);
	errorMessage = $state('');

	private threadDetails = $state<Record<string, ThreadDetail>>({});
	private workspaceLoadRequest = 0;
	private threadListRequest = 0;
	private readonly threadDetailRequests = new Map<string, number>();

	constructor(private readonly getUser: () => WorkspaceUser) {}

	get user() {
		return this.getUser();
	}

	start() {
		void this.load();
		return subscribeToWorkspaceChanges((change) => this.handleWorkspaceChange(change));
	}

	openCreateWorkspace = () => {
		this.swins.open(swinsLayout.createWorkspace.key, {}, 'Create workspace');
	};

	openSettings = () => {
		if (this.currentWorkspaceId) {
			this.swins.open(swinsLayout.settings.key, {}, 'Model Providers');
		}
	};

	selectWorkspace = async (workspaceId: string) => {
		if (workspaceId === this.currentWorkspaceId || this.switchingWorkspace) return;
		this.switchingWorkspace = true;
		this.clearError();
		try {
			await selectWorkspaceRequest(workspaceId);
			await this.load();
		} catch (error) {
			this.setError(error);
		} finally {
			this.switchingWorkspace = false;
		}
	};

	openThread = async (threadId: string) => {
		const summary = this.threads.find((thread) => thread.id === threadId);
		if (!summary) return;
		this.layout.openChatTab(threadId, summary.title);
		if (!this.threadDetails[threadId]) await this.refreshThread(threadId);
	};

	createThread = async (targetPanelId?: string) => {
		const workspaceId = this.currentWorkspaceId;
		if (!workspaceId) {
			this.openCreateWorkspace();
			return;
		}

		this.clearError();
		try {
			const created = await createThreadRequest(workspaceId);
			if (this.currentWorkspaceId !== workspaceId) return;
			this.threads = [
				created,
				...this.threads.filter((thread) => thread.id !== created.id)
			];
			this.layout.openChatTabInNewTab(created.id, created.title, targetPanelId);
			await this.refreshThread(created.id);
		} catch (error) {
			this.setError(error);
		}
	};

	openFiles = () => {
		if (this.currentWorkspaceId && !this.swins.current) {
			this.swins.open(swinsLayout.files.key, {}, 'Files');
		}
	};

	openWorkspaceFile = (entry: Extract<WorkspaceFsEntry, { type: 'file' }>) => {
		if (this.currentWorkspaceId) this.assetViewer.open(entry);
	};

	openWorkspaceFileInTab = (entry: Extract<WorkspaceFsEntry, { type: 'file' }>) => {
		if (this.currentWorkspaceId) this.layout.openFileTab(entry);
	};

	createWorkspace = async (name: string) => {
		this.clearError();
		await createWorkspaceRequest(name);
		await this.load();
	};

	getThread(threadId: string) {
		return this.threadDetails[threadId] ?? null;
	}

	listFiles = async (threadId: string, query = '') => {
		const workspaceId = this.currentWorkspaceId;
		if (!workspaceId) return [];
		return listWorkspaceFiles(workspaceId, threadId, query);
	};

	uploadFiles = async (threadId: string, files: File[]) => {
		const workspaceId = this.currentWorkspaceId;
		if (!workspaceId || files.length === 0) return [] satisfies WorkspaceFile[];
		return uploadThreadFiles(workspaceId, threadId, files);
	};

	removeUploadedFile = async (threadId: string, reference: string) => {
		const workspaceId = this.currentWorkspaceId;
		if (workspaceId) await removeThreadFile(workspaceId, threadId, reference);
	};

	getFileUrl = (threadId: string, reference: string) => {
		const workspaceId = this.currentWorkspaceId;
		return workspaceId
			? getWorkspaceFileUrl(workspaceId, threadId, reference)
			: '';
	};

	listWorkspaceDirectory = async (path = '') => {
		const workspaceId = this.currentWorkspaceId;
		return workspaceId ? listWorkspaceDirectory(workspaceId, path) : [];
	};

	uploadWorkspaceFiles = async (path: string, files: File[]) => {
		const workspaceId = this.currentWorkspaceId;
		if (!workspaceId || files.length === 0) return [] satisfies WorkspaceFsEntry[];
		return uploadWorkspaceFilesRequest(workspaceId, path, files);
	};

	createWorkspaceDirectory = async (path: string, name: string) => {
		const workspaceId = this.currentWorkspaceId;
		if (!workspaceId) throw new Error('Choose a workspace first.');
		return createWorkspaceDirectoryRequest(workspaceId, path, name);
	};

	renameWorkspaceEntry = async (path: string, name: string) => {
		const workspaceId = this.currentWorkspaceId;
		if (!workspaceId) throw new Error('Choose a workspace first.');
		return renameWorkspaceEntryRequest(workspaceId, path, name);
	};

	moveWorkspaceEntries = async (paths: string[], destinationPath: string) => {
		const workspaceId = this.currentWorkspaceId;
		if (!workspaceId) throw new Error('Choose a workspace first.');
		return moveWorkspaceEntriesRequest(workspaceId, paths, destinationPath);
	};

	removeWorkspaceEntry = async (path: string) => {
		const workspaceId = this.currentWorkspaceId;
		if (!workspaceId) throw new Error('Choose a workspace first.');
		await removeWorkspaceEntryRequest(workspaceId, path);
	};

	getWorkspaceAssetUrl = (path: string) => {
		const workspaceId = this.currentWorkspaceId;
		return workspaceId ? getWorkspaceAssetUrl(workspaceId, path) : '';
	};

	sendMessage = async (
		threadId: string,
		text: string,
		attachments: string[] = []
	) => {
		const workspaceId = this.currentWorkspaceId;
		const message = text.trim();
		if (!workspaceId || (!message && attachments.length === 0)) return;

		this.clearError();
		try {
			await sendMessageRequest(workspaceId, threadId, message, attachments);
			if (this.currentWorkspaceId !== workspaceId) return;
			await Promise.all([this.refreshThreads(), this.refreshThread(threadId)]);
		} catch (error) {
			this.setError(error);
			throw error;
		}
	};

	signOut = async () => {
		try {
			const result = await authClient.signOut();
			if (result.error) throw new Error(result.error.message ?? 'Could not sign out.');
		} catch (error) {
			this.setError(error);
		}
	};

	handleShortcut(event: KeyboardEvent) {
		if (!(event.metaKey || event.ctrlKey)) return;
		if (event.key.toLowerCase() === 't') {
			event.preventDefault();
			void this.createThread();
		}
		if (event.key.toLowerCase() === 'w') {
			event.preventDefault();
			this.layout.closeFocusedTab();
		}
	}

	private async load() {
		const request = ++this.workspaceLoadRequest;
		this.loading = true;
		this.clearError();
		try {
			const workspaces = await listWorkspaces();
			if (request !== this.workspaceLoadRequest) return;

			const currentWorkspace = workspaces.find((workspace) => workspace.isCurrent) ?? null;
			this.workspaces = workspaces;
			this.setCurrentWorkspace(currentWorkspace?.id ?? null);

			if (!currentWorkspace) {
				this.setThreads([]);
				return;
			}
			await this.loadThreads(currentWorkspace.id);
		} catch (error) {
			if (request === this.workspaceLoadRequest) this.setError(error);
		} finally {
			if (request === this.workspaceLoadRequest) this.loading = false;
		}
	}

	private setCurrentWorkspace(workspaceId: string | null) {
		if (workspaceId === this.currentWorkspaceId) return;
		this.currentWorkspaceId = workspaceId;
		this.swins.clear();
		this.assetViewer.close();
		this.threadListRequest += 1;
		this.threadDetailRequests.clear();
		this.threadDetails = {};
		this.layout.setWorkspace(workspaceId);
	}

	private async refreshThreads() {
		const workspaceId = this.currentWorkspaceId;
		if (workspaceId) await this.loadThreads(workspaceId);
	}

	private async loadThreads(workspaceId: string) {
		const request = ++this.threadListRequest;
		try {
			const threads = await listThreads(workspaceId);
			if (
				request !== this.threadListRequest ||
				this.currentWorkspaceId !== workspaceId
			) {
				return;
			}
			this.setThreads(threads);
		} catch (error) {
			if (
				request === this.threadListRequest &&
				this.currentWorkspaceId === workspaceId
			) {
				this.setError(error);
			}
		}
	}

	private setThreads(threads: ThreadSummary[]) {
		this.threads = threads;
		this.layout.updateThreads(threads);
	}

	private async refreshThread(threadId: string) {
		const workspaceId = this.currentWorkspaceId;
		if (!workspaceId) return;

		const request = (this.threadDetailRequests.get(threadId) ?? 0) + 1;
		this.threadDetailRequests.set(threadId, request);
		try {
			const thread = await getThreadRequest(workspaceId, threadId);
			if (
				this.threadDetailRequests.get(threadId) !== request ||
				this.currentWorkspaceId !== workspaceId
			) {
				return;
			}
			this.threadDetails = { ...this.threadDetails, [threadId]: thread };
		} catch (error) {
			if (this.threadDetailRequests.get(threadId) === request) this.setError(error);
		}
	}

	private handleWorkspaceChange(change: WorkspaceChange) {
		if (
			change.type === 'workspace.files.changed' &&
			change.workspaceId === this.currentWorkspaceId
		) {
			this.filesystemVersion += 1;
			return;
		}
		if (change.type === 'workspace.changed') {
			void this.load();
			return;
		}
		if (change.workspaceId !== this.currentWorkspaceId) return;

		void this.refreshThreads();
		if (change.threadId && this.threadDetails[change.threadId]) {
			void this.refreshThread(change.threadId);
		}
	}

	private clearError() {
		this.errorMessage = '';
	}

	private setError(error: unknown) {
		this.errorMessage = error instanceof Error ? error.message : 'Something went wrong.';
	}
}
