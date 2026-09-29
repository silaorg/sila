import { getAuth } from './auth';
import { getDatabase } from './database';
import { appEvents } from './app-events';
import { installRealtimeHost } from './realtime-host.js';

let ready: Promise<Awaited<ReturnType<typeof appEvents.start>>> | null = null;

export function initializeRealtime() {
	if (ready) return ready;
	ready = initialize().catch((error) => { ready = null; throw error; });
	return ready;
}

async function initialize() {
	const publicUrl = process.env.BETTER_AUTH_URL;
	if (!publicUrl) throw new Error('BETTER_AUTH_URL is required for authenticated realtime connections.');
	const auth = await getAuth();
	const sessionQuery = getDatabase().prepare('SELECT expiresAt FROM session WHERE id = ? AND userId = ?');
	const handlers = await appEvents.start({
		origin: new URL(publicUrl).origin,
		authenticate: async ({ headers }) => {
			const current = await auth.api.getSession({ headers });
			return current ? { id: current.user.id, sessionId: current.session.id } : null;
		},
		isSessionActive: (identity) => {
			if (typeof identity.sessionId !== 'string') return false;
			const session = sessionQuery.get(identity.sessionId, identity.id) as { expiresAt: number | string } | undefined;
			return !!session && new Date(session.expiresAt).getTime() > Date.now();
		}
	});
	await installRealtimeHost({ ...handlers, close: () => appEvents.close() });
	return handlers;
}
