import fs from 'node:fs';
import { Readable } from 'node:stream';
import type { RequestHandler } from './$types';
import { apiError, requireUser } from '$lib/server/api';
import { getWorkspaceContext } from '$lib/server/workspace-service';

export const GET: RequestHandler = async ({ locals, params, url }) => {
	const user = requireUser(locals);
	try {
		const { service } = await getWorkspaceContext(user.id, params.workspaceId);
		const file = await service.getWorkspaceFile(
			user.id,
			url.searchParams.get('path') ?? ''
		);
		const stream = fs.createReadStream(file.absolutePath);
		return new Response(Readable.toWeb(stream) as ReadableStream, {
			headers: {
				'content-type': file.mimeType,
				'content-length': String(file.size),
				'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
				'cache-control': 'private, max-age=60',
				'content-security-policy': 'sandbox',
				'x-content-type-options': 'nosniff'
			}
		});
	} catch (cause) {
		apiError(cause);
	}
};
