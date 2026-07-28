import type { Component } from 'svelte';

export type SwinComponentEntry = {
	component: Component<any>;
	defaultProps?: Record<string, unknown>;
};

export type SwinWindow = {
	id: string;
	componentId: string;
	title?: string;
	props?: Record<string, unknown>;
};

/**
 * Stack-based windows, adapted from Sila's SWins.
 *
 * Each window refers to a registered component and only the top window is
 * visible. Opening a child window preserves the previous one for back
 * navigation.
 */
export class Swins {
	componentRegistry = $state<Record<string, SwinComponentEntry>>({});
	windows = $state<SwinWindow[]>([]);
	overlayEnabled = $state(true);

	register(
		id: string,
		component: Component<any>,
		defaultProps: Record<string, unknown> = {}
	) {
		this.componentRegistry[id] = { component, defaultProps };
		return this;
	}

	open(
		componentId: string,
		props: Record<string, unknown> = {},
		title?: string
	) {
		if (!this.componentRegistry[componentId]) {
			console.error(`Swin component "${componentId}" is not registered.`);
			return this;
		}

		const id = `${componentId}-${crypto.randomUUID()}`;
		this.overlayEnabled = true;
		this.windows = [...this.windows, { id, componentId, props, title }];
		return this;
	}

	pop() {
		this.windows = this.windows.slice(0, -1);
		if (this.windows.length === 0) this.overlayEnabled = true;
		return this;
	}

	popToWindow(id: string) {
		const index = this.windows.findIndex((window) => window.id === id);
		if (index === -1) return false;
		this.windows = this.windows.slice(0, index + 1);
		return true;
	}

	clear() {
		this.windows = [];
		this.overlayEnabled = true;
		return this;
	}

	setOverlayEnabled(enabled: boolean) {
		this.overlayEnabled = enabled;
		return this;
	}

	get current() {
		return this.windows.at(-1);
	}
}
