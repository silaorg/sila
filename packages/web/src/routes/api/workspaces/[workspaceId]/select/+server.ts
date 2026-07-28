import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiError, requireUser } from '$lib/server/api';
import { selectWorkspace } from '$lib/server/workspace-service';
import { appEvents } from '$lib/server/app-events';

export const POST: RequestHandler = async ({ locals, params }) => {
	const user = requireUser(locals);
	try {
		const workspace = await selectWorkspace(user.id, params.workspaceId);
		appEvents.publish({
			type: 'workspace.changed',
			userId: user.id,
			workspaceId: workspace.id
		});
		return json(workspace);
	} catch (cause) {
		apiError(cause);
	}
};
