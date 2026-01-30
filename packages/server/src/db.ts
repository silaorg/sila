import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { SpacePointer } from "@sila/core";
import {
  FileSystemPersistenceLayer,
  Space as CoreSpace,
  SpaceManager,
  uuid,
} from "@sila/core";
import { NodeFileSystem } from "./utils/nodeFileSystem";

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

let db: Database.Database | null = null;
let dataDir: string | null = null;
const spaceManager = new SpaceManager();
const serverFs = new NodeFileSystem();
const spaceLayers = new Map<string, FileSystemPersistenceLayer>();

function ensureDbPath(dbPath: string): void {
  const dir = path.dirname(dbPath);
  fs.mkdirSync(dir, { recursive: true });
}

export function initDb(dbPath: string): Database.Database {
  if (db) return db;
  ensureDbPath(dbPath);
  dataDir = path.dirname(dbPath);
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
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

  const count = db.prepare("SELECT COUNT(*) as count FROM users").get() as {
    count: number;
  };

  if (count.count === 0) {
    const now = new Date().toISOString();
    const insertUser = db.prepare(
      "INSERT INTO users (id, email, created_at) VALUES (@id, @email, @createdAt)"
    );
    insertUser.run({ id: "demo-user-id", email: "demo@example.com", createdAt: now });
  }

  return db;
}

function getDb(): Database.Database {
  if (!db) {
    throw new Error("Database not initialized");
  }
  return db;
}

function getDataDir(): string {
  if (!dataDir) {
    throw new Error("Database not initialized");
  }
  return dataDir;
}

function getSpacePath(spaceId: string): string {
  return path.join(getDataDir(), "spaces", spaceId);
}

export function getUserById(userId: string): User | null {
  const row = getDb()
    .prepare("SELECT id, email, created_at as createdAt FROM users WHERE id = ?")
    .get(userId) as User | undefined;
  return row ?? null;
}

export function getUserByEmail(email: string): User | null {
  const row = getDb()
    .prepare("SELECT id, email, created_at as createdAt FROM users WHERE email = ?")
    .get(email) as User | undefined;
  return row ?? null;
}

export function listUsers(): User[] {
  return getDb()
    .prepare("SELECT id, email, created_at as createdAt FROM users ORDER BY email ASC")
    .all() as User[];
}

export function createUser(user: User): User {
  getDb()
    .prepare("INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)")
    .run(user.id, user.email, user.createdAt);
  return user;
}

export function listSpaces(): Space[] {
  return getDb()
    .prepare("SELECT id, name, created_at as createdAt FROM spaces ORDER BY name ASC")
    .all() as Space[];
}

export function getSpaceById(spaceId: string): Space | null {
  const row = getDb()
    .prepare("SELECT id, name, created_at as createdAt FROM spaces WHERE id = ?")
    .get(spaceId) as Space | undefined;
  return row ?? null;
}

export function createSpace(space: Space): Space {
  getDb()
    .prepare("INSERT INTO spaces (id, name, created_at) VALUES (?, ?, ?)")
    .run(space.id, space.name, space.createdAt);
  return space;
}

export async function getServerSpaceLayer(spaceId: string): Promise<FileSystemPersistenceLayer> {
  let layer = spaceLayers.get(spaceId);
  if (!layer) {
    layer = new FileSystemPersistenceLayer(getSpacePath(spaceId), spaceId, serverFs);
    await layer.connect();
    spaceLayers.set(spaceId, layer);
    return layer;
  }

  if (!layer.isConnected()) {
    await layer.connect();
  }

  return layer;
}

export async function getOrLoadServerSpace(spaceId: string): Promise<CoreSpace> {
  const existing = spaceManager.getSpace(spaceId);
  if (existing) {
    return existing;
  }

  const layer = await getServerSpaceLayer(spaceId);
  const row = getSpaceById(spaceId);
  const pointer: SpacePointer = {
    id: spaceId,
    uri: spaceId,
    name: row?.name ?? null,
    createdAt: row ? new Date(row.createdAt) : new Date(),
    userId: null,
  };

  return await spaceManager.loadSpace(pointer, [layer]);
}

export async function createServerSpace(input: {
  name: string;
  createdAt: string;
}): Promise<Space> {
  const space = CoreSpace.newSpace(uuid());
  space.name = input.name;
  const created = createSpace({
    id: space.getId(),
    name: input.name,
    createdAt: input.createdAt,
  });
  const layer = await getServerSpaceLayer(created.id);
  await spaceManager.addNewSpace(space, [layer], created.id);
  return created;
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
        SELECT s.id, s.name, s.created_at as createdAt
        FROM spaces s
        INNER JOIN space_access sa ON sa.space_id = s.id
        WHERE sa.user_id = ?
        ORDER BY s.name ASC
      `
    )
    .all(userId) as Space[];
}
