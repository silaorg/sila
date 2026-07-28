import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  createDefaultAgentConfig,
  createDefaultConfig,
  createProviderConfig,
} from "heswe";
import { AppWorkspaceError } from "heswe/app-workspace-service";

const MAX_WORKSPACE_NAME_LENGTH = 100;

/**
 * @typedef {import("better-sqlite3").Database} Database
 * @typedef {{
 *   id: string;
 *   owner_id: string;
 *   name: string;
 *   directory_path: string;
 *   created_at: string;
 * }} WorkspaceRow
 */

export class WorkspaceRegistry {
  /** @type {Database} */
  #database;
  /** @type {string} */
  #workspacesPath;

  /**
   * @param {{
   *   database: Database;
   *   workspacesPath: string;
   * }} options
   */
  constructor(options) {
    if (!options?.database) {
      throw new Error("WorkspaceRegistry requires a database.");
    }
    if (!options.workspacesPath) {
      throw new Error("WorkspaceRegistry requires workspacesPath.");
    }

    this.#database = options.database;
    this.#workspacesPath = path.resolve(options.workspacesPath);
    this.#setupSchema();
  }

  /**
   * @param {string} userId
   */
  async list(userId) {
    requireUserId(userId);
    const currentWorkspaceId = this.#getCurrentWorkspaceId(userId);
    const rows = /** @type {WorkspaceRow[]} */ (this.#database.prepare(`
      SELECT id, owner_id, name, directory_path, created_at
      FROM heswe_workspaces
      WHERE owner_id = ?
      ORDER BY created_at ASC, id ASC
    `).all(userId));

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      isCurrent: row.id === currentWorkspaceId,
    }));
  }

  /**
   * @param {string} userId
   * @param {string} workspaceId
   */
  async get(userId, workspaceId) {
    requireUserId(userId);
    const normalizedId = normalizeWorkspaceId(workspaceId);
    const row = this.#getWorkspaceRow(userId, normalizedId);
    return row ? toInternalWorkspace(row) : null;
  }

  /**
   * @param {string} userId
   * @param {{ name?: unknown }} input
   */
  async create(userId, input = {}) {
    requireUserId(userId);
    const name = normalizeWorkspaceName(input.name);
    const duplicate = this.#database.prepare(`
      SELECT id
      FROM heswe_workspaces
      WHERE owner_id = ? AND lower(name) = lower(?)
      LIMIT 1
    `).get(userId, name);
    if (duplicate) {
      throw new AppWorkspaceError(
        "invalid_input",
        `A workspace named "${name}" already exists.`,
      );
    }

    const id = randomUUID();
    const workspacePath = path.join(this.#workspacesPath, id);
    const createdAt = new Date().toISOString();
    await fs.mkdir(this.#workspacesPath, { recursive: true });
    await scaffoldHostedWorkspace(workspacePath, name);

    try {
      const save = this.#database.transaction(() => {
        this.#database.prepare(`
          INSERT INTO heswe_workspaces (
            id, owner_id, name, directory_path, created_at
          )
          VALUES (?, ?, ?, ?, ?)
        `).run(id, userId, name, workspacePath, createdAt);
        this.#setCurrentWorkspaceId(userId, id);
      });
      save();
    } catch (error) {
      await fs.rm(workspacePath, { recursive: true, force: true });
      if (isUniqueConstraintError(error)) {
        throw new AppWorkspaceError(
          "invalid_input",
          `A workspace named "${name}" already exists.`,
          { cause: error },
        );
      }
      throw error;
    }

    return {
      id,
      name,
      createdAt,
      isCurrent: true,
    };
  }

  /**
   * @param {string} userId
   * @param {string} workspaceId
   */
  async select(userId, workspaceId) {
    requireUserId(userId);
    const normalizedId = normalizeWorkspaceId(workspaceId);
    const row = this.#getWorkspaceRow(userId, normalizedId);
    if (!row) {
      throw new AppWorkspaceError(
        "not_found",
        `Workspace not found: ${normalizedId}`,
      );
    }
    this.#setCurrentWorkspaceId(userId, normalizedId);
    return {
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      isCurrent: true,
    };
  }

  #setupSchema() {
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS heswe_workspaces (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        name TEXT NOT NULL,
        directory_path TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS heswe_workspaces_owner_name
      ON heswe_workspaces(owner_id, name COLLATE NOCASE);

      CREATE TABLE IF NOT EXISTS heswe_workspace_selections (
        user_id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES heswe_workspaces(id) ON DELETE CASCADE,
        updated_at TEXT NOT NULL
      );
    `);
  }

  /**
   * @param {string} userId
   */
  #getCurrentWorkspaceId(userId) {
    const selection = /** @type {{ workspace_id: string } | undefined} */ (
      this.#database.prepare(`
      SELECT selection.workspace_id
      FROM heswe_workspace_selections AS selection
      INNER JOIN heswe_workspaces AS workspace ON workspace.id = selection.workspace_id
      WHERE selection.user_id = ? AND workspace.owner_id = ?
    `).get(userId, userId)
    );
    return selection?.workspace_id ?? null;
  }

  /**
   * @param {string} userId
   * @param {string} workspaceId
   */
  #setCurrentWorkspaceId(userId, workspaceId) {
    this.#database.prepare(`
      INSERT INTO heswe_workspace_selections (user_id, workspace_id, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        workspace_id = excluded.workspace_id,
        updated_at = excluded.updated_at
    `).run(userId, workspaceId, new Date().toISOString());
  }

  /**
   * @param {string} userId
   * @param {string} workspaceId
   * @returns {WorkspaceRow | undefined}
   */
  #getWorkspaceRow(userId, workspaceId) {
    return /** @type {WorkspaceRow | undefined} */ (this.#database.prepare(`
      SELECT id, owner_id, name, directory_path, created_at
      FROM heswe_workspaces
      WHERE id = ? AND owner_id = ?
    `).get(workspaceId, userId));
  }
}

/**
 * @param {string} workspacePath
 * @param {string} name
 */
async function scaffoldHostedWorkspace(workspacePath, name) {
  await fs.mkdir(workspacePath, { recursive: false });
  try {
    await createDefaultConfig(workspacePath, { name });
    await Promise.all([
      fs.mkdir(path.join(workspacePath, "assets")),
      fs.mkdir(path.join(workspacePath, "skills")),
      fs.mkdir(path.join(workspacePath, "tools")),
      fs.mkdir(path.join(workspacePath, "users")),
    ]);
    await createDefaultAgentConfig(workspacePath);
    await createProviderConfig(workspacePath, "openai");
  } catch (error) {
    await fs.rm(workspacePath, { recursive: true, force: true });
    throw error;
  }
}

/** @param {unknown} value */
function normalizeWorkspaceName(value) {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name) {
    throw new AppWorkspaceError(
      "invalid_input",
      "Workspace name is required.",
    );
  }
  if (name.length > MAX_WORKSPACE_NAME_LENGTH) {
    throw new AppWorkspaceError(
      "invalid_input",
      `Workspace name cannot exceed ${MAX_WORKSPACE_NAME_LENGTH} characters.`,
    );
  }
  if (/[\u0000-\u001f\u007f]/.test(name)) {
    throw new AppWorkspaceError(
      "invalid_input",
      "Workspace name contains unsupported characters.",
    );
  }
  return name;
}

/** @param {unknown} value */
function normalizeWorkspaceId(value) {
  const id = typeof value === "string" ? value.trim() : "";
  if (!id || id.length > 128) {
    throw new AppWorkspaceError("invalid_input", "Invalid workspace id.");
  }
  return id;
}

/** @param {unknown} value */
function requireUserId(value) {
  if (typeof value !== "string" || !value) {
    throw new AppWorkspaceError("invalid_input", "User id is required.");
  }
}

/** @param {unknown} error */
function isUniqueConstraintError(error) {
  return Boolean(
    error
    && typeof error === "object"
    && "code" in error
    && typeof error.code === "string"
    && error.code.startsWith("SQLITE_CONSTRAINT_UNIQUE"),
  );
}

/**
 * @param {WorkspaceRow} row
 */
function toInternalWorkspace(row) {
  return {
    id: row.id,
    name: row.name,
    workspacePath: row.directory_path,
    createdAt: row.created_at,
  };
}
