import { error } from '@sveltejs/kit';
import { AppWorkspaceError } from 'heswe/app-workspace-service';

const MAX_JSON_BODY_BYTES = 64 * 1024;

export function requireUser(locals: App.Locals) {
	if (!locals.user) {
		error(401, 'Sign in required.');
	}
	return locals.user;
}

export function apiError(cause: unknown): never {
	if (cause instanceof AppWorkspaceError) {
		if (cause.code === 'not_found') {
			error(404, cause.message);
		}
		if (cause.code === 'invalid_input') {
			error(400, cause.message);
		}
	}
	console.error('Workspace API request failed:', cause);
	error(500, 'Internal server error.');
}

export async function readJsonObject(request: Request, options: { optional?: boolean } = {}) {
	const raw = await readBoundedBody(request);
	if (!raw.trim()) {
		if (options.optional) return {};
		error(400, 'A JSON request body is required.');
	}

	let value: unknown;
	try {
		value = JSON.parse(raw);
	} catch {
		error(400, 'Request body must be valid JSON.');
	}
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		error(400, 'Request body must be a JSON object.');
	}
	return value as Record<string, unknown>;
}

async function readBoundedBody(request: Request) {
	const declaredLength = Number(request.headers.get('content-length'));
	if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BODY_BYTES) {
		error(413, 'Request body is too large.');
	}
	if (!request.body) return '';

	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let byteLength = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			byteLength += value.byteLength;
			if (byteLength > MAX_JSON_BODY_BYTES) {
				await reader.cancel();
				error(413, 'Request body is too large.');
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}

	const body = new Uint8Array(byteLength);
	let offset = 0;
	for (const chunk of chunks) {
		body.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return new TextDecoder().decode(body);
}
