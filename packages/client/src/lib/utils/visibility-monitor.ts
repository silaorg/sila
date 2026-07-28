export class TargetVisibilityMonitor {
	private intersectionObserver?: IntersectionObserver;
	private mutationObserver?: MutationObserver;
	private isMonitoring = false;

	constructor(
		private readonly element: HTMLElement,
		private readonly onHidden: () => void
	) {}

	start() {
		if (this.isMonitoring) return;
		this.isMonitoring = true;

		this.intersectionObserver = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.intersectionRatio === 0) this.onHidden();
			},
			{ threshold: 0 }
		);
		this.intersectionObserver.observe(this.element);

		this.mutationObserver = new MutationObserver(() => {
			requestAnimationFrame(() => this.checkVisibility());
		});
		let current: Element | null = this.element;
		while (current) {
			this.mutationObserver.observe(current, {
				attributes: true,
				attributeFilter: ['style', 'class'],
				childList: true
			});
			current = current.parentElement;
		}

		this.checkVisibility();
	}

	stop() {
		if (!this.isMonitoring) return;
		this.isMonitoring = false;
		this.intersectionObserver?.disconnect();
		this.mutationObserver?.disconnect();
	}

	private checkVisibility() {
		if (!document.contains(this.element)) {
			this.onHidden();
			return;
		}

		const styles = window.getComputedStyle(this.element);
		const rect = this.element.getBoundingClientRect();
		if (
			styles.display === 'none'
			|| styles.visibility === 'hidden'
			|| Number.parseFloat(styles.opacity) === 0
			|| (rect.width === 0 && rect.height === 0)
		) {
			this.onHidden();
		}
	}
}
