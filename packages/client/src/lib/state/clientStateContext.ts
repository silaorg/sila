import { getContext, setContext, hasContext } from 'svelte';
import type { ClientState } from './clientState.svelte';

const CLIENT_STATE = Symbol('CLIENT_STATE');

export function provideClientState(instance: ClientState): void {
	setContext(CLIENT_STATE, instance);
}

export function getClientStateFromContext(): ClientState | null {
	try {
		if (hasContext(CLIENT_STATE)) {
			return getContext<ClientState>(CLIENT_STATE);
		}
	} catch (_) {
		// getContext/hasContext may throw outside component init; ignore and return null
	}
	return null;
}

export { CLIENT_STATE };

