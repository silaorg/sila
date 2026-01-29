import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export type User = {
  id: string;
  email: string;
};

export type Space = {
  id: string;
  name: string;
};

export type SpaceMember = {
  userId: string;
  email: string;
  role: string;
};

let db: Database.Database | null = null;

function ensureDbPath(dbPath: string): void {
  const dir = path.dirname(dbPath);
  fs.mkdirSync(dir, { recursive: true });
}

export function initDb(dbPath: string): Database.Database {
  if (db) return db;
  ensureDbPath(dbPath);
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS spaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS space_access (
      user_id TEXT NOT NULL,
      space_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, space_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_space_access_user ON space_access(user_id);
    CREATE INDEX IF NOT EXISTS idx_space_access_space ON space_access(space_id);
  `);

  const count = db.prepare("SELECT COUNT(*) as count FROM users").get() as {
    count: number;
  };

  if (count.count === 0) {
    const insertUser = db.prepare(
      "INSERT INTO users (id, email) VALUES (@id, @email)"
    );
    const insertSpace = db.prepare(
      "INSERT INTO spaces (id, name) VALUES (@id, @name)"
    );
    const insertAccess = db.prepare(
      "INSERT INTO space_access (user_id, space_id, role) VALUES (@userId, @spaceId, @role)"
    );

    insertUser.run({ id: "demo-token", email: "demo@example.com" });
    insertSpace.run({ id: "space-1", name: "Demo Space" });
    insertSpace.run({ id: "space-2", name: "Team Space" });
    insertAccess.run({ userId: "demo-token", spaceId: "space-1", role: "owner" });
    insertAccess.run({ userId: "demo-token", spaceId: "space-2", role: "member" });
  }

  return db;
}

function getDb(): Database.Database {
  if (!db) {
    throw new Error("Database not initialized");
  }
  return db;
}

export function getUserById(userId: string): User | null {
  const row = getDb()
    .prepare("SELECT id, email FROM users WHERE id = ?")
    .get(userId) as User | undefined;
  return row ?? null;
}

export function listUsers(): User[] {
  return getDb()
    .prepare("SELECT id, email FROM users ORDER BY email ASC")
    .all() as User[];
}

export function createUser(user: User): User {
  getDb()
    .prepare("INSERT INTO users (id, email) VALUES (?, ?)")
    .run(user.id, user.email);
  return user;
}

export function listSpaces(): Space[] {
  return getDb()
    .prepare("SELECT id, name FROM spaces ORDER BY name ASC")
    .all() as Space[];
}

export function createSpace(space: Space): Space {
  getDb()
    .prepare("INSERT INTO spaces (id, name) VALUES (?, ?)")
    .run(space.id, space.name);
  return space;
}

export function addSpaceMember(
  spaceId: string,
  userId: string,
  role = "member"
): void {
  getDb()
    .prepare(
      "INSERT OR REPLACE INTO space_access (user_id, space_id, role) VALUES (?, ?, ?)"
    )
    .run(userId, spaceId, role);
}

export function listSpaceMembers(spaceId: string): SpaceMember[] {
  return getDb()
    .prepare(
      `
        SELECT sa.user_id as userId, u.email, sa.role as role
        FROM space_access sa
        INNER JOIN users u ON u.id = sa.user_id
        WHERE sa.space_id = ?
        ORDER BY u.email ASC
      `
    )
    .all(spaceId) as SpaceMember[];
}

export function getSpacesForUserId(userId: string): Space[] {
  return getDb()
    .prepare(
      `
        SELECT s.id, s.name
        FROM spaces s
        INNER JOIN space_access sa ON sa.space_id = s.id
        WHERE sa.user_id = ?
        ORDER BY s.name ASC
      `
    )
    .all(userId) as Space[];
}
