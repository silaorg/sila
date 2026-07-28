import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiError, requireUser } from '$lib/server/api';
import { getWorkspaceContext } from '$lib/server/workspace-service';

export const GET: RequestHandler = async ({ locals, params, url }) => {
	const user = requireUser(locals);
	try {
		const threadId = url.searchParams.get('threadId') ?? '';
		const query = url.searchParams.get('query') ?? '';
		const { service } = await getWorkspaceContext(user.id, params.workspaceId);
		return json(await service.listFiles(user.id, threadId, query));
	} catch (cause) {
		apiError(cause);
	}
};
