export type WorkspaceSummary = {
	id: string;
	name: string;
	createdAt: string;
	isCurrent: boolean;
};

export type ThreadSummary = {
	id: string;
	title: string;
	createdAt: string;
	updatedAt: string;
	messageCount: number;
	preview: string;
};

export type ThreadMessage = {
	id: string | null;
	at: string | null;
	role: string;
	text: string;
};

export type ThreadDetail = ThreadSummary & {
	messages: ThreadMessage[];
};

export type WorkspaceChange = {
	type: 'thread.created' | 'thread.changed' | 'workspace.changed';
	workspaceId?: string;
	threadId?: string;
};

export type WorkspaceProviderSetting = {
	id: string;
	name: string;
	kind: 'language' | 'search' | 'viz';
	local: boolean;
	defaultModel: string | null;
	model: string | null;
	enabled: boolean | null;
	apiKeySource: 'workspace' | 'server' | 'none';
};

export type WorkspaceModelSettings = {
	provider: string;
	model: string;
	providers: WorkspaceProviderSetting[];
};

export function listWorkspaces() {
	return requestJson<WorkspaceSummary[]>('/api/workspaces');
}

export function createWorkspace(name: string) {
	return requestJson<WorkspaceSummary>('/api/workspaces', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ name })
	});
}

export function selectWorkspace(workspaceId: string) {
	return requestJson<WorkspaceSummary>(
		`/api/workspaces/${encodeURIComponent(workspaceId)}/select`,
		{ method: 'POST' }
	);
}

export function getWorkspaceModelSettings(workspaceId: string) {
	return requestJson<WorkspaceModelSettings>(
		workspaceUrl(workspaceId, '/settings/models')
	);
}

export function updateWorkspaceModelSettings(
	workspaceId: string,
	settings: {
		provider: string;
		model: string;
		apiKeys: Record<string, string | null>;
	}
) {
	return requestJson<WorkspaceModelSettings>(
		workspaceUrl(workspaceId, '/settings/models'),
		{
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(settings)
		}
	);
}

export function listThreads(workspaceId: string) {
	return requestJson<ThreadSummary[]>(workspaceUrl(workspaceId, '/threads'));
}

export function createThread(workspaceId: string, title?: string) {
	return requestJson<ThreadSummary>(workspaceUrl(workspaceId, '/threads'), {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ title })
	});
}

export function getThread(workspaceId: string, threadId: string) {
	return requestJson<ThreadDetail>(
		workspaceUrl(workspaceId, `/threads/${encodeURIComponent(threadId)}`)
	);
}

export function sendMessage(workspaceId: string, threadId: string, text: string) {
	return requestJson<{ responded: boolean; answer: string }>(
		workspaceUrl(
			workspaceId,
			`/threads/${encodeURIComponent(threadId)}/messages`
		),
		{
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ text })
		}
	);
}

function workspaceUrl(workspaceId: string, suffix = '') {
	return `/api/workspaces/${encodeURIComponent(workspaceId)}${suffix}`;
}

export function subscribeToWorkspaceChanges(onChange: (change: WorkspaceChange) => void) {
	const events = new EventSource('/api/events');
	const receive = (event: MessageEvent<string>) => {
		try {
			const change = JSON.parse(event.data);
			if (
				change &&
				typeof change === 'object' &&
				(change.type === 'thread.created' ||
					change.type === 'thread.changed' ||
					change.type === 'workspace.changed') &&
				(change.workspaceId === undefined || typeof change.workspaceId === 'string')
			) {
				onChange(change);
			}
		} catch {
			// Ignore malformed events. The next valid invalidation will refresh the snapshots.
		}
	};
	events.addEventListener('thread.created', receive);
	events.addEventListener('thread.changed', receive);
	events.addEventListener('workspace.changed', receive);
	return () => events.close();
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
	const response = await fetch(url, init);
	if (!response.ok) {
		const body = await response.json().catch(() => null);
		throw new Error(body?.message ?? `Request failed with HTTP ${response.status}.`);
	}
	return response.json();
}
