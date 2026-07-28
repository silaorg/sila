import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/api';
import { createAppEventResponse } from '$lib/server/app-events';

export const GET: RequestHandler = async ({ locals }) => {
	const user = requireUser(locals);
	return createAppEventResponse(user.id);
};
