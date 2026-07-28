import { building } from '$app/environment';
import type { Handle } from '@sveltejs/kit';
import { getAuth } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
	if (building) {
		return resolve(event);
	}

	const auth = await getAuth();
	const current = await auth.api.getSession({ headers: event.request.headers });
	event.locals.session = current?.session ?? null;
	event.locals.user = current?.user ?? null;
	const response = await resolve(event);
	response.headers.set('x-content-type-options', 'nosniff');
	response.headers.set('referrer-policy', 'same-origin');
	response.headers.set('x-frame-options', 'DENY');
	if (
		event.url.pathname.startsWith('/api/')
		&& !response.headers.has('cache-control')
	) {
		response.headers.set('cache-control', 'private, no-store');
	}
	return response;
};
