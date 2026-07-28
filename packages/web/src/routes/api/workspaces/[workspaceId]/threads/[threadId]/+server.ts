import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiError, requireUser } from '$lib/server/api';
import { getWorkspaceContext } from '$lib/server/workspace-service';

export const GET: RequestHandler = async ({ locals, params }) => {
	const user = requireUser(locals);
	try {
		const { service } = await getWorkspaceContext(user.id, params.workspaceId);
		return json(await service.getThread(user.id, params.threadId));
	} catch (cause) {
		apiError(cause);
	}
};
