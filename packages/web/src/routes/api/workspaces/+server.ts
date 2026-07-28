import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiError, readJsonObject, requireUser } from '$lib/server/api';
import {
	createWorkspace,
	listWorkspaces
} from '$lib/server/workspace-service';
import { appEvents } from '$lib/server/app-events';

export const GET: RequestHandler = async ({ locals }) => {
	const user = requireUser(locals);
	try {
		return json(await listWorkspaces(user.id));
	} catch (cause) {
		apiError(cause);
	}
};

export const POST: RequestHandler = async ({ locals, request }) => {
	const user = requireUser(locals);
	try {
		const body = await readJsonObject(request);
		const workspace = await createWorkspace(user.id, body);
		appEvents.publish({
			type: 'workspace.changed',
			userId: user.id,
			workspaceId: workspace.id
		});
		return json(workspace, { status: 201 });
	} catch (cause) {
		apiError(cause);
	}
};
