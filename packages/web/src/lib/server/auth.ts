import { randomBytes } from 'node:crypto';
import { betterAuth } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { dev } from '$app/environment';
import { getDatabase } from './database';

let authPromise: ReturnType<typeof createAuth> | null = null;

export function getAuth() {
	if (!authPromise) {
		authPromise = createAuth();
	}
	return authPromise;
}

async function createAuth() {
	const secret =
		process.env.BETTER_AUTH_SECRET ??
		(dev ? randomBytes(32).toString('base64url') : '');
	if (!secret) {
		throw new Error('BETTER_AUTH_SECRET is required.');
	}
	if (secret.length < 32) {
		throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters.');
	}

	const auth = betterAuth({
		appName: 'Heswe',
		secret,
		baseURL: process.env.BETTER_AUTH_URL,
		database: getDatabase(),
		emailAndPassword: {
			enabled: true,
			minPasswordLength: 8
		},
		session: {
			expiresIn: 60 * 60 * 24 * 7,
			updateAge: 60 * 60 * 24
		},
		advanced: {
			database: {
				generateId: 'uuid'
			}
		}
	});

	const { runMigrations } = await getMigrations(auth.options);
	await runMigrations();
	return auth;
}
