import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { getDatabase } from "../src/lib/server/database.ts";

test("failed database configuration is not cached", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "heswe-database-"));
  const previousPath = process.env.HESWE_AUTH_DB_PATH;
  t.after(async () => {
    if (previousPath === undefined) delete process.env.HESWE_AUTH_DB_PATH;
    else process.env.HESWE_AUTH_DB_PATH = previousPath;
    await fs.rm(root, { recursive: true, force: true });
  });
  const invalidPath = path.join(root, "invalid.sqlite");
  await fs.writeFile(invalidPath, "not a SQLite database");
  process.env.HESWE_AUTH_DB_PATH = invalidPath;
  assert.throws(() => getDatabase(), /not a database/);

  process.env.HESWE_AUTH_DB_PATH = path.join(root, "valid.sqlite");
  const database = getDatabase();
  t.after(() => database.close());
  assert.equal(database.pragma("journal_mode", { simple: true }), "wal");
  assert.equal(database.pragma("foreign_keys", { simple: true }), 1);
  assert.equal(getDatabase(), database);
});
