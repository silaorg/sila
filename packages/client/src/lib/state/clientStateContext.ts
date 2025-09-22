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

export function useClientState(): ClientState {
	const instance = getClientStateFromContext();
	if (instance) return instance;
	// Return a lazy-throwing proxy so importing modules that call this in top-level
	// script don't fail during unrelated test/setup. Any actual usage will throw.
	return new Proxy({}, {
		get() {
			throw new Error('ClientState not found in context. Wrap your component tree in <ClientStateProvider>.');
		}
	}) as unknown as ClientState;
}

export function useClientStateOptional(): ClientState | null {
	return getClientStateFromContext();
}

