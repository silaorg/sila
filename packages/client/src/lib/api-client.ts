export type WorkspaceInfo = {
	name: string;
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

export function getWorkspace() {
	return requestJson<WorkspaceInfo>('/api/workspace');
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

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
	const response = await fetch(url, init);
	if (!response.ok) {
		const body = await response.json().catch(() => null);
		throw new Error(body?.message ?? `Request failed with HTTP ${response.status}.`);
	}
	return response.json();
}
