import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiError, requireUser } from '$lib/server/api';
import { getWorkspaceService } from '$lib/server/workspace-service';

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const user = requireUser(locals);
	try {
		const body = await request.json();
		return json(
			await getWorkspaceService().sendMessage(user.id, params.threadId, body?.text)
		);
	} catch (cause) {
		apiError(cause);
	}
};
