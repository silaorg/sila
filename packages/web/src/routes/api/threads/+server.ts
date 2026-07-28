import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiError, requireUser } from '$lib/server/api';
import { getWorkspaceService } from '$lib/server/workspace-service';

export const GET: RequestHandler = async ({ locals }) => {
	const user = requireUser(locals);
	try {
		return json(await getWorkspaceService().listThreads(user.id));
	} catch (cause) {
		apiError(cause);
	}
};

export const POST: RequestHandler = async ({ locals, request }) => {
	const user = requireUser(locals);
	try {
		const body = await request.json().catch(() => ({}));
		return json(await getWorkspaceService().createThread(user.id, body), { status: 201 });
	} catch (cause) {
		apiError(cause);
	}
};
