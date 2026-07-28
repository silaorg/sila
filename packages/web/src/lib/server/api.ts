import { error } from '@sveltejs/kit';

export function requireUser(locals: App.Locals) {
	if (!locals.user) {
		error(401, 'Sign in required.');
	}
	return locals.user;
}

export function apiError(cause: unknown): never {
	const message = cause instanceof Error ? cause.message : String(cause);
	if (/not found/i.test(message)) {
		error(404, message);
	}
	if (/required|invalid|cannot exceed/i.test(message)) {
		error(400, message);
	}
	error(500, message);
}
