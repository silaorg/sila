import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiError, readJsonObject, requireUser } from '$lib/server/api';
import { getWorkspaceContext } from '$lib/server/workspace-service';

export const GET: RequestHandler = async ({ locals, params }) => {
	const user = requireUser(locals);
	try {
		const { service } = await getWorkspaceContext(user.id, params.workspaceId);
		return json(await service.listThreads(user.id));
	} catch (cause) {
		apiError(cause);
	}
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const user = requireUser(locals);
	try {
		const body = await readJsonObject(request, { optional: true });
		const { service } = await getWorkspaceContext(user.id, params.workspaceId);
		return json(await service.createThread(user.id, body), { status: 201 });
	} catch (cause) {
		apiError(cause);
	}
};
