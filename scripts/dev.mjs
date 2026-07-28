import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_API_PORT = 39900;
export const DEV_HOST = "127.0.0.1";
const DEV_LOCK_ROOT = join(tmpdir(), "heswe-dev-port-pairs");

function isProcessRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function readLockOwner(lockPath) {
  try {
    return JSON.parse(readFileSync(join(lockPath, "owner.json"), "utf8"));
  } catch {
    return null;
  }
}

function isStaleLock(lockPath, owner) {
  if (owner) {
    return !isProcessRunning(owner.pid);
  }

  try {
    return Date.now() - statSync(lockPath).mtimeMs > 30_000;
  } catch (error) {
    return error?.code !== "ENOENT";
  }
}

function acquirePairLock(lockRoot, apiPort, dashboardPort, host, dashboardEnabled) {
  mkdirSync(lockRoot, { recursive: true });
  const lockPath = join(lockRoot, `${apiPort}-${dashboardPort}`);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      mkdirSync(lockPath);
      const token = randomUUID();
      writeFileSync(
        join(lockPath, "owner.json"),
        `${JSON.stringify({
          pid: process.pid,
          token,
          worktree: resolve(process.cwd()),
          apiUrl: `http://${host}:${apiPort}`,
          dashboardUrl: dashboardEnabled
            ? `http://${host}:${dashboardPort}`
            : null,
        })}\n`,
      );

      return () => {
        const owner = readLockOwner(lockPath);
        if (owner?.token === token) {
          rmSync(lockPath, { recursive: true, force: true });
        }
      };
    } catch (error) {
      if (error?.code !== "EEXIST") {
        throw error;
      }

      const owner = readLockOwner(lockPath);
      if (!isStaleLock(lockPath, owner)) {
        return null;
      }

      rmSync(lockPath, { recursive: true, force: true });
    }
  }

  return null;
}

export function isPortAvailable(port, host = DEV_HOST) {
  return new Promise((resolveAvailability) => {
    const server = createServer();
    server.unref();
    server.once("error", () => resolveAvailability(false));
    server.listen({ host, port, exclusive: true }, () => {
      server.close(() => resolveAvailability(true));
    });
  });
}

export function listRunningDevStacks({
  lockRoot = DEV_LOCK_ROOT,
  worktree = process.cwd(),
} = {}) {
  let entries;
  try {
    entries = readdirSync(lockRoot, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const resolvedWorktree = resolve(worktree);
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => readLockOwner(join(lockRoot, entry.name)))
    .filter((owner) => (
      owner
      && owner.worktree === resolvedWorktree
      && isProcessRunning(owner.pid)
      && typeof owner.apiUrl === "string"
      && (
        owner.dashboardUrl === null
        || typeof owner.dashboardUrl === "string"
      )
    ))
    .sort((left, right) => left.apiUrl.localeCompare(right.apiUrl));
}

export async function reserveAvailablePortPair({
  startingApiPort = DEFAULT_API_PORT,
  host = DEV_HOST,
  lockRoot = DEV_LOCK_ROOT,
  dashboardEnabled = true,
} = {}) {
  if (
    !Number.isInteger(startingApiPort)
    || startingApiPort < 1024
    || startingApiPort > 65534
    || startingApiPort % 2 !== 0
  ) {
    throw new Error("The starting API port must be an even port from 1024 to 65534.");
  }

  for (
    let apiPort = startingApiPort;
    apiPort <= 65534;
    apiPort += 2
  ) {
    const dashboardPort = apiPort + 1;
    const release = acquirePairLock(
      lockRoot,
      apiPort,
      dashboardPort,
      host,
      dashboardEnabled,
    );
    if (!release) {
      continue;
    }

    const [apiAvailable, dashboardAvailable] = await Promise.all([
      isPortAvailable(apiPort, host),
      isPortAvailable(dashboardPort, host),
    ]);

    if (apiAvailable && dashboardAvailable) {
      return {
        apiPort,
        dashboardPort,
        dashboardEnabled,
        release,
      };
    }

    release();
  }

  throw new Error(`No available API/dashboard port pair found from ${startingApiPort}.`);
}

export function createDevEnvironment({
  apiPort,
  dashboardPort,
  dashboardEnabled = true,
  host = DEV_HOST,
  environment = process.env,
}) {
  const apiUrl = `http://${host}:${apiPort}`;
  const dashboardUrl = `http://${host}:${dashboardPort}`;

  return {
    ...environment,
    HESWE_DEV_HOST: host,
    HESWE_API_PORT: String(apiPort),
    HESWE_API_URL: apiUrl,
    HESWE_DASHBOARD_PORT: String(dashboardPort),
    HESWE_DASHBOARD_URL: dashboardUrl,
    BETTER_AUTH_URL: dashboardEnabled ? dashboardUrl : apiUrl,
  };
}

export async function runDev({ dashboardEnabled = true } = {}) {
  const reservation = await reserveAvailablePortPair({ dashboardEnabled });
  const { apiPort, dashboardPort } = reservation;
  const apiUrl = `http://${DEV_HOST}:${apiPort}`;
  const dashboardUrl = `http://${DEV_HOST}:${dashboardPort}`;

  console.log("");
  console.log("Heswe dev stack");
  console.log(`  API:       ${apiUrl}`);
  if (dashboardEnabled) {
    console.log(`  Dashboard: ${dashboardUrl}`);
  }
  if (apiPort !== DEFAULT_API_PORT) {
    console.log(`  Ports ${DEFAULT_API_PORT}/${DEFAULT_API_PORT + 1} were unavailable.`);
  }
  console.log("");

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const child = spawn(
    npmCommand,
    ["run", dashboardEnabled ? "dev:services" : "dev:api-services"],
    {
      env: createDevEnvironment(reservation),
      stdio: "inherit",
    },
  );

  let stopping = false;
  const stopChild = (signal) => {
    if (stopping) {
      return;
    }
    stopping = true;
    child.kill(signal);
  };

  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.once(signal, () => stopChild(signal));
  }

  try {
    const result = await new Promise((resolveExit) => {
      child.once("error", (error) => resolveExit({ error }));
      child.once("exit", (code, signal) => resolveExit({ code, signal }));
    });

    if (result.error) {
      throw result.error;
    }
    if (typeof result.code === "number") {
      process.exitCode = result.code;
    } else if (!stopping && result.signal) {
      console.error(`Dev services stopped by ${result.signal}.`);
      process.exitCode = 1;
    }
  } finally {
    reservation.release();
  }
}

function printDevPorts() {
  const stacks = listRunningDevStacks();
  if (stacks.length === 0) {
    console.error(`No running Heswe dev stack found for ${process.cwd()}.`);
    process.exitCode = 1;
    return;
  }

  for (const stack of stacks) {
    console.log("Heswe dev stack");
    console.log(`  API:       ${stack.apiUrl}`);
    if (stack.dashboardUrl) {
      console.log(`  Dashboard: ${stack.dashboardUrl}`);
    }
    console.log(`  PID:       ${stack.pid}`);
  }
}

const isMainModule =
  process.argv[1]
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  if (process.argv[2] === "--ports") {
    printDevPorts();
  } else {
    runDev({ dashboardEnabled: process.argv[2] !== "--api-only" }).catch((error) => {
      console.error(`Unable to start Heswe: ${error.message}`);
      process.exitCode = 1;
    });
  }
}
