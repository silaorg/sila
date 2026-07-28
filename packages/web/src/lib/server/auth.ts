import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { betterAuth } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { dev } from '$app/environment';

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
		(dev ? 'heswe-development-secret-change-before-production' : '');
	if (!secret) {
		throw new Error('BETTER_AUTH_SECRET is required.');
	}

	const databasePath = path.resolve(
		process.env.HESWE_AUTH_DB_PATH ?? path.join(process.cwd(), '.data', 'heswe.sqlite')
	);
	fs.mkdirSync(path.dirname(databasePath), { recursive: true });
	const database = new Database(databasePath);
	database.pragma('journal_mode = WAL');
	database.pragma('foreign_keys = ON');

	const auth = betterAuth({
		appName: 'Heswe',
		secret,
		baseURL: process.env.BETTER_AUTH_URL,
		database,
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
