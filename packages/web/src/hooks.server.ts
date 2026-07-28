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
	return resolve(event);
};
