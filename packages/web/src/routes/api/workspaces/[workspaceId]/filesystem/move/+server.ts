import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiError, readJsonObject, requireUser } from '$lib/server/api';
import { getWorkspaceContext } from '$lib/server/workspace-service';

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const user = requireUser(locals);
	try {
		const input = await readJsonObject(request);
		const { service } = await getWorkspaceContext(user.id, params.workspaceId);
		return json(
			await service.moveWorkspaceEntries(
				user.id,
				input.paths,
				typeof input.destinationPath === 'string' ? input.destinationPath : ''
			)
		);
	} catch (cause) {
		apiError(cause);
	}
};
