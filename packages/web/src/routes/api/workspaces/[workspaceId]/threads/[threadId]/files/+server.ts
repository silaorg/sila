import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	apiError,
	readJsonObject,
	readMultipartFiles,
	requireUser
} from '$lib/server/api';
import { getWorkspaceContext } from '$lib/server/workspace-service';

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const user = requireUser(locals);
	try {
		const uploads = await readMultipartFiles(request);
		const files = await Promise.all(uploads.map(async (file) => ({
			name: file.name,
			data: new Uint8Array(await file.arrayBuffer())
		})));
		const { service } = await getWorkspaceContext(user.id, params.workspaceId);
		return json(await service.uploadFiles(user.id, params.threadId, files));
	} catch (cause) {
		apiError(cause);
	}
};

export const DELETE: RequestHandler = async ({ locals, params, request }) => {
	const user = requireUser(locals);
	try {
		const body = await readJsonObject(request);
		const { service } = await getWorkspaceContext(user.id, params.workspaceId);
		await service.removeUploadedFile(user.id, params.threadId, body.reference);
		return new Response(null, { status: 204 });
	} catch (cause) {
		apiError(cause);
	}
};
