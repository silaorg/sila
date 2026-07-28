import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiError, readJsonObject, requireUser } from '$lib/server/api';
import { getWorkspaceContext } from '$lib/server/workspace-service';

export const GET: RequestHandler = async ({ locals, params, url }) => {
	const user = requireUser(locals);
	try {
		const { service } = await getWorkspaceContext(user.id, params.workspaceId);
		return json(
			await service.browseWorkspaceFiles(user.id, url.searchParams.get('path') ?? '')
		);
	} catch (cause) {
		apiError(cause);
	}
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const user = requireUser(locals);
	try {
		const input = await readJsonObject(request);
		const { service } = await getWorkspaceContext(user.id, params.workspaceId);
		return json(
			await service.createWorkspaceDirectory(user.id, stringValue(input.path), input.name),
			{ status: 201 }
		);
	} catch (cause) {
		apiError(cause);
	}
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	const user = requireUser(locals);
	try {
		const input = await readJsonObject(request);
		const { service } = await getWorkspaceContext(user.id, params.workspaceId);
		return json(
			await service.renameWorkspaceEntry(user.id, stringValue(input.path), input.name)
		);
	} catch (cause) {
		apiError(cause);
	}
};

export const DELETE: RequestHandler = async ({ locals, params, request }) => {
	const user = requireUser(locals);
	try {
		const input = await readJsonObject(request);
		const { service } = await getWorkspaceContext(user.id, params.workspaceId);
		await service.removeWorkspaceEntry(user.id, stringValue(input.path));
		return new Response(null, { status: 204 });
	} catch (cause) {
		apiError(cause);
	}
};

function stringValue(value: unknown) {
	return typeof value === 'string' ? value : '';
}
