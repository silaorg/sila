import type { RequestHandler } from './$types';
import { apiError, createFileResponse, requireUser } from '$lib/server/api';
import { getWorkspaceContext } from '$lib/server/workspace-service';

export const GET: RequestHandler = async ({ locals, params, url }) => {
	const user = requireUser(locals);
	try {
		const threadId = url.searchParams.get('threadId') ?? '';
		const reference = url.searchParams.get('reference') ?? '';
		const { service } = await getWorkspaceContext(user.id, params.workspaceId);
		const file = await service.getFile(user.id, threadId, reference);
		return createFileResponse(file);
	} catch (cause) {
		apiError(cause);
	}
};
