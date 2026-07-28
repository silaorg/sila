import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiError, readMultipartFiles, requireUser } from '$lib/server/api';
import { getWorkspaceContext } from '$lib/server/workspace-service';

export const POST: RequestHandler = async ({ locals, params, request, url }) => {
	const user = requireUser(locals);
	try {
		const uploads = await readMultipartFiles(request);
		const files = await Promise.all(uploads.map(async (file) => ({
			name: file.name,
			data: new Uint8Array(await file.arrayBuffer())
		})));
		const { service } = await getWorkspaceContext(user.id, params.workspaceId);
		return json(
			await service.uploadWorkspaceFiles(
				user.id,
				url.searchParams.get('path') ?? '',
				files
			),
			{ status: 201 }
		);
	} catch (cause) {
		apiError(cause);
	}
};
