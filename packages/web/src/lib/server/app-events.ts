import { NodeRouter, type NodeRouterOptions } from 'neorest/node';
import type { ConnectionIdentity, ServerConnection } from 'neorest/core';

export type AppEvent = {
	type: string;
	userId: string;
	workspaceId?: string;
	threadId?: string;
};

type Options = {
	origin: string;
	authenticate: NonNullable<NodeRouterOptions['authenticateConnection']>;
	isSessionActive: (identity: Readonly<ConnectionIdentity>) => boolean | Promise<boolean>;
};

export class AppEventBroker {
	private router: NodeRouter | null = null;
	private starting: Promise<Awaited<ReturnType<NodeRouter['createHandlers']>>> | null = null;

	start(options: Options) {
		if (this.starting) return this.starting;
		const router = new NodeRouter({
			disableHttpRoutes: true,
			cors: { origin: options.origin, credentials: true },
			authenticateConnection: options.authenticate,
			connectionGracePeriodMs: 15_000,
			maxRequestBodyBytes: 64 * 1024,
		});
		const authorize = async (connection: ServerConnection, params: Record<string, string>) => {
			const identity = connection.getIdentity();
			return !!identity && identity.id === params.userId && await options.isSessionActive(identity);
		};
		router.onAuthorizeSubscription('/users/:userId/events', authorize);
		router.onValidateBroadcast('/users/:userId/events', authorize);
		this.router = router;
		this.starting = router.createHandlers().catch(async (error) => {
			await this.close();
			throw error;
		});
		return this.starting;
	}

	publish = ({ userId, ...event }: AppEvent) => {
		this.router?.broadcast(`/users/${encodeURIComponent(userId)}/events`, {
			action: 'UPDATE', data: event
		});
	};

	async close() {
		const router = this.router;
		this.router = null;
		this.starting = null;
		await router?.close();
	}
}

export const appEvents = new AppEventBroker();
