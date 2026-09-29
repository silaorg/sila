// Keep at most one refresh in flight per resource. Invalidations received while
// it runs require one more snapshot, since the current response may be stale.
export class RefreshQueue {
	private pending = new Map<string, { dirty: boolean; task: () => Promise<void> }>();
	private stopped = false;

	private readonly onError: (error: unknown) => void;

	constructor(onError: (error: unknown) => void) {
		this.onError = onError;
	}

	request(key: string, task: () => Promise<void>) {
		if (this.stopped) return;
		const existing = this.pending.get(key);
		if (existing) {
			existing.dirty = true;
			existing.task = task;
			return;
		}
		const entry = { dirty: true, task };
		this.pending.set(key, entry);
		void this.run(key, entry);
	}

	stop() {
		this.stopped = true;
		this.pending.clear();
	}

	private async run(key: string, entry: { dirty: boolean; task: () => Promise<void> }) {
		// Coalesce events delivered in the same turn before starting a request.
		await Promise.resolve();
		try {
			while (entry.dirty && !this.stopped) {
				entry.dirty = false;
				try {
					await entry.task();
				} catch (error) {
					if (!this.stopped) this.onError(error);
				}
			}
		} finally {
			this.pending.delete(key);
		}
	}
}
