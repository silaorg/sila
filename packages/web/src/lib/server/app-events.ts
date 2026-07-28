export type AppEvent = {
	type: string;
	userId: string;
	threadId?: string;
};

type Subscriber = (event: AppEvent) => void;

const textEncoder = new TextEncoder();

export class AppEventBroker {
	private subscribersByUser = new Map<string, Set<Subscriber>>();

	publish = (event: AppEvent) => {
		for (const subscriber of this.subscribersByUser.get(event.userId) ?? []) {
			subscriber(event);
		}
	};

	createResponse(userId: string, signal: AbortSignal) {
		let cleanup = () => {};
		const stream = new ReadableStream<Uint8Array>({
			start: (controller) => {
				let closed = false;
				let heartbeat: ReturnType<typeof setInterval> | undefined;

				cleanup = () => {
					if (closed) return;
					closed = true;
					if (heartbeat) clearInterval(heartbeat);
					signal.removeEventListener('abort', cleanup);
					const subscribers = this.subscribersByUser.get(userId);
					subscribers?.delete(publish);
					if (subscribers?.size === 0) {
						this.subscribersByUser.delete(userId);
					}
				};

				const enqueue = (payload: Uint8Array) => {
					if (closed) return;
					try {
						controller.enqueue(payload);
					} catch {
						cleanup();
					}
				};
				const publish = (event: AppEvent) =>
					enqueue(encodeEvent(event.type, {
						type: event.type,
						...(event.threadId ? { threadId: event.threadId } : {})
					}));
				const subscribers = this.subscribersByUser.get(userId) ?? new Set<Subscriber>();
				subscribers.add(publish);
				this.subscribersByUser.set(userId, subscribers);

				signal.addEventListener('abort', cleanup, { once: true });
				if (signal.aborted) {
					cleanup();
					controller.close();
					return;
				}

				enqueue(encodeEvent('connected', { type: 'connected' }));
				heartbeat = setInterval(() => enqueue(textEncoder.encode(': heartbeat\n\n')), 20_000);
				heartbeat.unref?.();
			},
			cancel() {
				cleanup();
			}
		});

		return new Response(stream, {
			headers: {
				'content-type': 'text/event-stream',
				'cache-control': 'no-cache, no-transform',
				connection: 'keep-alive',
				'x-accel-buffering': 'no'
			}
		});
	}
}

export const appEvents = new AppEventBroker();

function encodeEvent(name: string, data: unknown) {
	return textEncoder.encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
}
