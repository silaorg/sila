import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiError, requireUser } from '$lib/server/api';
import { getWorkspaceService } from '$lib/server/workspace-service';

export const GET: RequestHandler = async ({ locals }) => {
	requireUser(locals);
	try {
		return json(await getWorkspaceService().getWorkspace());
	} catch (cause) {
		apiError(cause);
	}
};
