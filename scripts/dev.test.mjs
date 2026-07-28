import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  createDevEnvironment,
  listRunningDevStacks,
  reserveAvailablePortPair,
} from "./dev.mjs";

function createLockRoot() {
  return mkdtempSync(join(tmpdir(), "heswe-dev-test-"));
}

test("reserves an API-first port pair and exports matching URLs", async (context) => {
  const lockRoot = createLockRoot();
  context.after(() => rmSync(lockRoot, { recursive: true, force: true }));

  const reservation = await reserveAvailablePortPair({
    startingApiPort: 43300,
    lockRoot,
  });
  context.after(reservation.release);

  assert.equal(reservation.apiPort, 43300);
  assert.equal(reservation.dashboardPort, 43301);

  const environment = createDevEnvironment(reservation);
  assert.equal(environment.HESWE_DEV_HOST, "127.0.0.1");
  assert.equal(environment.HESWE_API_PORT, "43300");
  assert.equal(environment.HESWE_API_URL, "http://127.0.0.1:43300");
  assert.equal(environment.HESWE_DASHBOARD_PORT, "43301");
  assert.equal(environment.HESWE_DASHBOARD_URL, "http://127.0.0.1:43301");
  assert.equal(environment.BETTER_AUTH_URL, "http://127.0.0.1:43301");
});

test("API-only mode uses the API origin for authentication", () => {
  const environment = createDevEnvironment({
    apiPort: 43300,
    dashboardPort: 43301,
    dashboardEnabled: false,
  });

  assert.equal(environment.BETTER_AUTH_URL, "http://127.0.0.1:43300");
});

test("a second launcher advances to the next pair", async (context) => {
  const lockRoot = createLockRoot();
  context.after(() => rmSync(lockRoot, { recursive: true, force: true }));

  const first = await reserveAvailablePortPair({
    startingApiPort: 43400,
    lockRoot,
  });
  context.after(first.release);

  const second = await reserveAvailablePortPair({
    startingApiPort: first.apiPort,
    lockRoot,
  });
  context.after(second.release);

  assert.ok(second.apiPort >= first.apiPort + 2);
  assert.equal(second.apiPort % 2, 0);
  assert.equal(second.dashboardPort, second.apiPort + 1);
});

test("reports running stacks only for the current worktree", async (context) => {
  const lockRoot = createLockRoot();
  context.after(() => rmSync(lockRoot, { recursive: true, force: true }));

  const reservation = await reserveAvailablePortPair({
    startingApiPort: 43450,
    lockRoot,
  });

  assert.deepEqual(
    listRunningDevStacks({ lockRoot, worktree: process.cwd() }).map((stack) => ({
      apiUrl: stack.apiUrl,
      dashboardUrl: stack.dashboardUrl,
    })),
    [{
      apiUrl: `http://127.0.0.1:${reservation.apiPort}`,
      dashboardUrl: `http://127.0.0.1:${reservation.dashboardPort}`,
    }],
  );
  assert.deepEqual(
    listRunningDevStacks({ lockRoot, worktree: join(process.cwd(), "other-worktree") }),
    [],
  );

  reservation.release();
  assert.deepEqual(listRunningDevStacks({ lockRoot, worktree: process.cwd() }), []);
});

for (const blockedService of ["API", "dashboard"]) {
  test(`an occupied ${blockedService} port skips the whole pair`, async (context) => {
    const lockRoot = createLockRoot();
    context.after(() => rmSync(lockRoot, { recursive: true, force: true }));

    const initial = await reserveAvailablePortPair({
      startingApiPort: blockedService === "API" ? 43500 : 43550,
      lockRoot,
    });
    initial.release();

    const blocker = createServer();
    await new Promise((resolveListen, rejectListen) => {
      blocker.once("error", rejectListen);
      blocker.listen(
        blockedService === "API" ? initial.apiPort : initial.dashboardPort,
        "127.0.0.1",
        resolveListen,
      );
    });
    context.after(() => blocker.close());

    const next = await reserveAvailablePortPair({
      startingApiPort: initial.apiPort,
      lockRoot,
    });
    context.after(next.release);

    assert.ok(next.apiPort >= initial.apiPort + 2);
    assert.equal(next.dashboardPort, next.apiPort + 1);
  });
}
