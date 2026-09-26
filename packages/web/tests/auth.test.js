import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { registerHooks } from "node:module";
import test from "node:test";

test("auth initialization can retry after a database open failure", async (t) => {
  // Node does not resolve SvelteKit's virtual environment module.
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === "$app/environment") {
        return { url: "data:text/javascript,export const dev = true", shortCircuit: true };
      }
      if (specifier === "./database" && context.parentURL?.endsWith("/server/auth.ts")) {
        return nextResolve("./database.ts", context);
      }
      return nextResolve(specifier, context);
    },
  });
  t.after(() => hooks.deregister());
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "heswe-auth-"));
  const previousPath = process.env.HESWE_AUTH_DB_PATH;
  t.after(async () => {
    if (previousPath === undefined) delete process.env.HESWE_AUTH_DB_PATH;
    else process.env.HESWE_AUTH_DB_PATH = previousPath;
    await fs.rm(root, { recursive: true, force: true });
  });
  const { getAuth } = await import("../src/lib/server/auth.ts");
  process.env.HESWE_AUTH_DB_PATH = root; // Opening a directory must fail.
  await assert.rejects(getAuth());
  process.env.HESWE_AUTH_DB_PATH = path.join(root, "auth.sqlite");
  const retry = getAuth();
  assert.equal(getAuth(), retry);
  const auth = await retry;
  assert.ok(auth.api.getSession);
  const { getDatabase } = await import("../src/lib/server/database.ts");
  t.after(() => getDatabase().close());
  assert.ok(getDatabase().prepare("SELECT name FROM sqlite_master WHERE name = 'user'").get());
});
