import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiError, readJsonObject, requireUser } from '$lib/server/api';
import { getWorkspaceContext } from '$lib/server/workspace-service';

export const GET: RequestHandler = async ({ locals, params }) => {
	const user = requireUser(locals);
	try {
		const { service } = await getWorkspaceContext(user.id, params.workspaceId);
		return json(await service.getModelSettings());
	} catch (cause) {
		apiError(cause);
	}
};

export const PUT: RequestHandler = async ({ locals, params, request }) => {
	const user = requireUser(locals);
	try {
		const body = await readJsonObject(request);
		const { service } = await getWorkspaceContext(user.id, params.workspaceId);
		return json(await service.updateModelSettings(body));
	} catch (cause) {
		apiError(cause);
	}
};
