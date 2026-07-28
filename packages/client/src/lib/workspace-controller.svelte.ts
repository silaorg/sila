import {
	createThread as createThreadRequest,
	createWorkspace as createWorkspaceRequest,
	getThread as getThreadRequest,
	listThreads,
	listWorkspaces,
	selectWorkspace as selectWorkspaceRequest,
	sendMessage as sendMessageRequest,
	subscribeToWorkspaceChanges,
	type ThreadDetail,
	type ThreadSummary,
	type WorkspaceChange,
	type WorkspaceSummary
} from './api-client';
import { authClient } from './auth-client';
import { WorkspaceLayout } from './workspace-layout.svelte';
import type { WorkspaceUiContext, WorkspaceUser } from './workspace-ui-context';

export class WorkspaceController implements WorkspaceUiContext {
	readonly layout = new WorkspaceLayout();

	currentWorkspaceId = $state<string | null>(null);
	workspaces = $state<WorkspaceSummary[]>([]);
	threads = $state<ThreadSummary[]>([]);
	loading = $state(true);
	switchingWorkspace = $state(false);
	errorMessage = $state('');
	createWorkspaceOpen = $state(false);
	settingsOpen = $state(false);

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
		this.createWorkspaceOpen = true;
	};

	closeCreateWorkspace = () => {
		this.createWorkspaceOpen = false;
	};

	openSettings = () => {
		if (this.currentWorkspaceId) this.settingsOpen = true;
	};

	closeSettings = () => {
		this.settingsOpen = false;
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

	createWorkspace = async (name: string) => {
		this.clearError();
		await createWorkspaceRequest(name);
		this.closeCreateWorkspace();
		await this.load();
	};

	getThread(threadId: string) {
		return this.threadDetails[threadId] ?? null;
	}

	sendMessage = async (threadId: string, text: string) => {
		const workspaceId = this.currentWorkspaceId;
		const message = text.trim();
		if (!workspaceId || !message) return;

		this.clearError();
		try {
			await sendMessageRequest(workspaceId, threadId, message);
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
