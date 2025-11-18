import { getContext, setContext, hasContext } from 'svelte';
import type { ChatAppData } from '@sila/core';

const CHAT_APP_DATA = Symbol('CHAT_APP_DATA');

export function provideChatAppData(instance: ChatAppData): void {
	setContext(CHAT_APP_DATA, instance);
}

export function getChatAppDataFromContext(): ChatAppData | null {
	try {
		if (hasContext(CHAT_APP_DATA)) {
			return getContext<ChatAppData>(CHAT_APP_DATA);
		}
	} catch (_) {
		// getContext/hasContext may throw outside component init; ignore and return null
	}
	return null;
}

export function useChatAppData(): ChatAppData {
	const instance = getChatAppDataFromContext();
	if (instance) return instance;
	// Return a lazy-throwing proxy so importing modules that call this in top-level
	// script don't fail during unrelated test/setup. Any actual usage will throw.
	return new Proxy({}, {
		get() {
			throw new Error('ChatAppData not found in context. Wrap your component tree in <ChatApp>.');
		}
	}) as unknown as ChatAppData;
}

export function useChatAppDataOptional(): ChatAppData | null {
	return getChatAppDataFromContext();
}

