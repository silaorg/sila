import type { Client } from 'neorest';
import type { WorkspaceChange } from './api-client';

type EventClient = Pick<Client, 'connect' | 'subscribe' | 'onConnectionChange' | 'close'>;

export function subscribeToChanges(
	client: EventClient,
	userId: string,
	onChange: (change: WorkspaceChange) => void,
	onError: (error: unknown) => void
) {
	let closed = false;
	let subscribed = false;
	const removeListener = client.onConnectionChange((connected) => {
		// Neorest restores subscriptions before reporting a reconnect. Refresh
		// snapshots as well, since broadcasts are not durable history.
		if (connected && subscribed && !closed) onChange({ type: 'connected' });
	});
	void (async () => {
		await client.connect();
		if (closed) return;
		await client.subscribe(`/users/${encodeURIComponent(userId)}/events`, (event) => {
			if (!closed && isWorkspaceChange(event.data)) onChange(event.data);
		});
		if (closed) return;
		subscribed = true;
		onChange({ type: 'connected' });
	})().catch((error) => {
		if (closed) return;
		removeListener();
		client.close();
		onError(error);
	});
	return () => {
		closed = true;
		removeListener();
		client.close();
	};
}

function isWorkspaceChange(value: unknown): value is WorkspaceChange {
	if (!value || typeof value !== 'object') return false;
	const change = value as Partial<WorkspaceChange>;
	return ['thread.created', 'thread.changed', 'workspace.changed', 'workspace.files.changed'].includes(change.type ?? '')
		&& (change.workspaceId === undefined || typeof change.workspaceId === 'string')
		&& (change.threadId === undefined || typeof change.threadId === 'string');
}
