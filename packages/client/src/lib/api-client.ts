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
	attachments: WorkspaceFile[];
	activities?: ThreadActivity[];
};

export type ThreadActivity = {
	id: string;
	name: string;
	preview: string;
	status: 'running' | 'complete';
};

export type ThreadProgress = {
	status: 'processing' | 'thinking' | 'acting';
	text: string;
	activities: ThreadActivity[];
};

export type WorkspaceFile = {
	reference: string;
	scope: 'workspace' | 'thread';
	path: string;
	name: string;
	size: number;
	mimeType: string;
	kind: 'image' | 'text' | 'file';
};

export type WorkspaceFsEntry =
	| {
			path: string;
			name: string;
			type: 'directory';
			size: 0;
	  }
	| (WorkspaceFile & {
			path: string;
			type: 'file';
	  });

export type ThreadDetail = ThreadSummary & {
	messages: ThreadMessage[];
	progress: ThreadProgress | null;
};

export type WorkspaceChange = {
	type: 'thread.created' | 'thread.changed' | 'workspace.changed' | 'workspace.files.changed';
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

export function listWorkspaceFiles(workspaceId: string, threadId: string, query = '') {
	const params = new URLSearchParams({ threadId });
	if (query) params.set('query', query);
	return requestJson<WorkspaceFile[]>(
		`${workspaceUrl(workspaceId, '/files')}?${params}`
	);
}

export function listWorkspaceDirectory(workspaceId: string, path = '') {
	const params = path ? `?${new URLSearchParams({ path })}` : '';
	return requestJson<WorkspaceFsEntry[]>(
		`${workspaceUrl(workspaceId, '/filesystem')}${params}`
	);
}

export function uploadWorkspaceFiles(workspaceId: string, path: string, files: File[]) {
	const form = new FormData();
	for (const file of files) form.append('files', file);
	const params = path ? `?${new URLSearchParams({ path })}` : '';
	return requestJson<WorkspaceFsEntry[]>(
		`${workspaceUrl(workspaceId, '/filesystem/files')}${params}`,
		{ method: 'POST', body: form }
	);
}

export function createWorkspaceDirectory(workspaceId: string, path: string, name: string) {
	return requestJson<WorkspaceFsEntry>(workspaceUrl(workspaceId, '/filesystem'), {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ path, name })
	});
}

export function renameWorkspaceEntry(workspaceId: string, path: string, name: string) {
	return requestJson<WorkspaceFsEntry>(workspaceUrl(workspaceId, '/filesystem'), {
		method: 'PATCH',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ path, name })
	});
}

export function moveWorkspaceEntries(
	workspaceId: string,
	paths: string[],
	destinationPath: string
) {
	return requestJson<WorkspaceFsEntry[]>(
		workspaceUrl(workspaceId, '/filesystem/move'),
		{
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ paths, destinationPath })
		}
	);
}

export function removeWorkspaceEntry(workspaceId: string, path: string) {
	return requestEmpty(workspaceUrl(workspaceId, '/filesystem'), {
		method: 'DELETE',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ path })
	});
}

export function getWorkspaceAssetUrl(workspaceId: string, path: string) {
	return `${workspaceUrl(workspaceId, '/filesystem/content')}?${new URLSearchParams({ path })}`;
}

export function uploadThreadFiles(
	workspaceId: string,
	threadId: string,
	files: File[]
) {
	const form = new FormData();
	for (const file of files) form.append('files', file);
	return requestJson<WorkspaceFile[]>(
		workspaceUrl(workspaceId, `/threads/${encodeURIComponent(threadId)}/files`),
		{ method: 'POST', body: form }
	);
}

export function removeThreadFile(
	workspaceId: string,
	threadId: string,
	reference: string
) {
	return requestEmpty(
		workspaceUrl(workspaceId, `/threads/${encodeURIComponent(threadId)}/files`),
		{
			method: 'DELETE',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ reference })
		}
	);
}

export function getWorkspaceFileUrl(
	workspaceId: string,
	threadId: string,
	reference: string
) {
	const params = new URLSearchParams({ threadId, reference });
	return `${workspaceUrl(workspaceId, '/files/content')}?${params}`;
}

export function sendMessage(
	workspaceId: string,
	threadId: string,
	text: string,
	attachments: string[] = []
) {
	return requestJson<{ responded: boolean; answer: string }>(
		workspaceUrl(
			workspaceId,
			`/threads/${encodeURIComponent(threadId)}/messages`
		),
		{
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ text, attachments })
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
					change.type === 'workspace.changed' ||
					change.type === 'workspace.files.changed') &&
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
	events.addEventListener('workspace.files.changed', receive);
	return () => events.close();
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
	const response = await fetch(url, init);
	await requireOk(response);
	return response.json();
}

async function requestEmpty(url: string, init?: RequestInit) {
	const response = await fetch(url, init);
	await requireOk(response);
}

async function requireOk(response: Response) {
	if (!response.ok) {
		const body = await response.json().catch(() => null);
		throw new Error(body?.message ?? `Request failed with HTTP ${response.status}.`);
	}
}
