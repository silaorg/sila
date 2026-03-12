import { getContext, hasContext, setContext } from 'svelte';
import type { ClientState } from './clientState.svelte';

const CLIENT_STATE = Symbol('CLIENT_STATE');

export function provideClientState(getInstance: () => ClientState): void {
	setContext(CLIENT_STATE, getInstance);
}

export function getClientStateOptional(): ClientState | null {
	try {
		if (hasContext(CLIENT_STATE)) {
			return getContext<() => ClientState>(CLIENT_STATE)();
		}
	} catch (_) {
		return null;
	}

	return null;
}

export function useClientState(): ClientState {
	const instance = getClientStateOptional();

	if (instance) {
		return instance;
	}

	throw new Error('ClientState not found in context. Wrap your component tree in <ClientStateProvider>.');
}
