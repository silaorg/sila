import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiError, requireUser } from '$lib/server/api';
import { getCurrentWorkspace } from '$lib/server/workspace-service';

export const GET: RequestHandler = async ({ locals }) => {
	const user = requireUser(locals);
	try {
		const workspace = await getCurrentWorkspace(user.id);
		return json(workspace ? { id: workspace.id, name: workspace.name } : null);
	} catch (cause) {
		apiError(cause);
	}
};
