type AppEvent = {
	type: string;
	userId: string;
	threadId?: string;
};

const encodersByUser = new Map<string, Set<(event: AppEvent) => void>>();
const textEncoder = new TextEncoder();

export function publishAppEvent(event: AppEvent) {
	for (const publish of encodersByUser.get(event.userId) ?? []) {
		publish(event);
	}
}

export function createAppEventResponse(userId: string) {
	let unsubscribe = () => {};
	let heartbeat: ReturnType<typeof setInterval> | undefined;
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			const publish = (event: AppEvent) => {
				controller.enqueue(encodeEvent(event.type, event));
			};
			const subscribers = encodersByUser.get(userId) ?? new Set();
			subscribers.add(publish);
			encodersByUser.set(userId, subscribers);

			unsubscribe = () => {
				subscribers.delete(publish);
				if (subscribers.size === 0) {
					encodersByUser.delete(userId);
				}
			};
			controller.enqueue(encodeEvent('connected', { type: 'connected', userId }));
			heartbeat = setInterval(() => controller.enqueue(textEncoder.encode(': heartbeat\n\n')), 20_000);
		},
		cancel() {
			unsubscribe();
			if (heartbeat) clearInterval(heartbeat);
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

function encodeEvent(name: string, data: unknown) {
	return textEncoder.encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
}
