export type WorkspaceInfo = {
	id: string;
	name: string;
};

export type WorkspaceSummary = WorkspaceInfo & {
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
	threadId?: string;
};

export function getWorkspace() {
	return requestJson<WorkspaceInfo | null>('/api/workspace');
}

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

export function listThreads() {
	return requestJson<ThreadSummary[]>('/api/threads');
}

export function createThread(title?: string) {
	return requestJson<ThreadSummary>('/api/threads', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ title })
	});
}

export function getThread(threadId: string) {
	return requestJson<ThreadDetail>(`/api/threads/${encodeURIComponent(threadId)}`);
}

export function sendMessage(threadId: string, text: string) {
	return requestJson<{ responded: boolean; answer: string }>(
		`/api/threads/${encodeURIComponent(threadId)}/messages`,
		{
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ text })
		}
	);
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
					change.type === 'workspace.changed')
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
