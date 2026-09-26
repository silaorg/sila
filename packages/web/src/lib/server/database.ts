import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

let database: Database.Database | null = null;

export function getDatabasePath() {
	return path.resolve(
		process.env.HESWE_AUTH_DB_PATH ?? path.join(process.cwd(), '.data', 'heswe.sqlite')
	);
}

export function getDatabase() {
	if (database) return database;

	const databasePath = getDatabasePath();
	fs.mkdirSync(path.dirname(databasePath), { recursive: true });
	const opened = new Database(databasePath);
	try {
		opened.pragma('journal_mode = WAL');
		opened.pragma('foreign_keys = ON');
	} catch (error) {
		opened.close();
		throw error;
	}
	database = opened;
	return database;
}
