import { Client } from 'neorest';

export type WorkspaceChange = {
	type: 'connected' | 'thread.created' | 'thread.changed' | 'workspace.changed' | 'workspace.files.changed';
	workspaceId?: string;
	threadId?: string;
};

export function subscribeToWorkspaceChanges(
	userId: string,
	onChange: (change: WorkspaceChange) => void,
	onError: (error: unknown) => void
) {
	const client = new Client(window.location.origin, 'auto', {
		transports: ['websocket'],
		timeout: 15_000,
	});
	return subscribeToChanges(client, userId, onChange, onError);
}

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
	const stop = () => {
		if (closed) return;
		closed = true;
		removeListener();
		client.close();
	};
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
		stop();
		onError(error);
	});
	return stop;
}

function isWorkspaceChange(value: unknown): value is WorkspaceChange {
	if (!value || typeof value !== 'object') return false;
	const change = value as Partial<WorkspaceChange>;
	return ['thread.created', 'thread.changed', 'workspace.changed', 'workspace.files.changed'].includes(change.type ?? '')
		&& (change.workspaceId === undefined || typeof change.workspaceId === 'string')
		&& (change.threadId === undefined || typeof change.threadId === 'string');
}
