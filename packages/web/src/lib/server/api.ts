import { error, isHttpError } from '@sveltejs/kit';
import { AppWorkspaceError } from 'heswe/app-workspace-service';

const MAX_JSON_BODY_BYTES = 64 * 1024;
const MAX_MULTIPART_BODY_BYTES = 42 * 1024 * 1024;

export function requireUser(locals: App.Locals) {
	if (!locals.user) {
		error(401, 'Sign in required.');
	}
	return locals.user;
}

export function apiError(cause: unknown): never {
	if (isHttpError(cause)) {
		throw cause;
	}
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
	const raw = new TextDecoder().decode(await readBoundedBody(request, MAX_JSON_BODY_BYTES));
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

export async function readMultipartFiles(request: Request) {
	const contentType = request.headers.get('content-type') ?? '';
	if (!contentType.toLowerCase().startsWith('multipart/form-data;')) {
		error(415, 'A multipart form upload is required.');
	}
	const body = await readBoundedBody(request, MAX_MULTIPART_BODY_BYTES);
	const bufferedRequest = new Request(request.url, {
		method: 'POST',
		headers: { 'content-type': contentType },
		body
	});
	let form: FormData;
	try {
		form = await bufferedRequest.formData();
	} catch {
		error(400, 'Upload must contain valid multipart form data.');
	}
	return form.getAll('files').filter((entry): entry is File => entry instanceof File);
}

async function readBoundedBody(request: Request, maxBytes: number) {
	const declaredLength = Number(request.headers.get('content-length'));
	if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
		error(413, 'Request body is too large.');
	}
	if (!request.body) return new Uint8Array();

	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let byteLength = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			byteLength += value.byteLength;
			if (byteLength > maxBytes) {
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
	return body;
}
