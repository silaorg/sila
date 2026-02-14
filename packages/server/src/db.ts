import fs from "node:fs";
import path from "node:path";
import DatabaseFn from "better-sqlite3";
import {
  Space as CoreSpace,
} from "@sila/core";

export type User = {
  id: string;
  email: string;
  createdAt: string;
};

export type Space = {
  id: string;
  name: string;
  createdAt: string;
};

export type SpaceMember = {
  userId: string;
  email: string;
  role: string;
};

export class Database {
  private db: DatabaseFn.Database;
  private dataDir: string;

  constructor(dbPath: string) {
    const dir = path.dirname(dbPath);
    fs.mkdirSync(dir, { recursive: true });
    this.dataDir = dir;
    this.db = new DatabaseFn(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.initSchema();
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS spaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
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

    const count = this.db.prepare("SELECT COUNT(*) as count FROM users").get() as {
      count: number;
    };

    if (count.count === 0) {
      const now = new Date().toISOString();
      const insertUser = this.db.prepare(
        "INSERT INTO users (id, email, created_at) VALUES (@id, @email, @createdAt)"
      );
      insertUser.run({ id: "demo-user-id", email: "demo@example.com", createdAt: now });
    }
  }

  close() {
    this.db.close();
  }

  getUserById(userId: string): User | null {
    const row = this.db
      .prepare("SELECT id, email, created_at as createdAt FROM users WHERE id = ?")
      .get(userId) as User | undefined;
    return row ?? null;
  }

  getUserByEmail(email: string): User | null {
    const row = this.db
      .prepare("SELECT id, email, created_at as createdAt FROM users WHERE email = ?")
      .get(email) as User | undefined;
    return row ?? null;
  }

  listUsers(): User[] {
    return this.db
      .prepare("SELECT id, email, created_at as createdAt FROM users ORDER BY email ASC")
      .all() as User[];
  }

  createUser(user: User): User {
    this.db
      .prepare("INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)")
      .run(user.id, user.email, user.createdAt);
    return user;
  }

  listSpaces(): Space[] {
    return this.db
      .prepare("SELECT id, name, created_at as createdAt FROM spaces ORDER BY name ASC")
      .all() as Space[];
  }

  getSpaceById(spaceId: string): Space | null {
    const row = this.db
      .prepare("SELECT id, name, created_at as createdAt FROM spaces WHERE id = ?")
      .get(spaceId) as Space | undefined;
    return row ?? null;
  }

  createSpace(space: Space): Space {
    this.db
      .prepare("INSERT INTO spaces (id, name, created_at) VALUES (?, ?, ?)")
      .run(space.id, space.name, space.createdAt);
    return space;
  }

  addSpaceMember(
    spaceId: string,
    userId: string,
    role = "member"
  ): void {
    this.db
      .prepare(
        "INSERT OR REPLACE INTO space_access (user_id, space_id, role) VALUES (?, ?, ?)"
      )
      .run(userId, spaceId, role);
  }

  listSpaceMembers(spaceId: string): SpaceMember[] {
    return this.db
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

  getSpacesForUserId(userId: string): Space[] {
    return this.db
      .prepare(
        `
          SELECT s.id, s.name, s.created_at as createdAt
          FROM spaces s
          INNER JOIN space_access sa ON sa.space_id = s.id
          WHERE sa.user_id = ?
          ORDER BY s.name ASC
        `
      )
      .all(userId) as Space[];
  }
}
