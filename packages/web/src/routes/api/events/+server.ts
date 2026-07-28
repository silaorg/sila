import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/api';
import { appEvents } from '$lib/server/app-events';

export const GET: RequestHandler = async ({ locals, request }) => {
	const user = requireUser(locals);
	return appEvents.createResponse(user.id, request.signal);
};
