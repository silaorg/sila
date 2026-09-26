import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { ProcessAgentRuntime } from "./process-agent-runtime.js";

const execFileAsync = promisify(execFile);
const CONTAINER_WORKSPACE_PATH = "/workspace";
const DEFAULT_DOCKER_COMMAND = "docker";
const SANDBOX_ENV_NAMES = Object.freeze([
  "LANG",
  "LC_ALL",
  "PTY_COMMAND_TIMEOUT_MS",
  "PTY_IDLE_TTL_MS",
  "PTY_MAX_OUTPUT_BYTES",
  "PTY_SHELL",
  "TZ",
]);
const DOCKER_ENV_NAMES = Object.freeze([
  "DOCKER_CONFIG",
  "DOCKER_CONTEXT",
  "DOCKER_HOST",
  "DOCKER_TLS_VERIFY",
  "HOME",
  "PATH",
  "XDG_RUNTIME_DIR",
]);

export class RunscAgentRuntime {
  #runtime;

  constructor(options = {}) {
    const configuration = normalizeRunscConfiguration(options);
    const workspacePath = validateWorkspaceMount({
      workspaceId: configuration.workspaceId,
      workspacePath: options.workspacePath,
      workspaceRoot: options.workspaceRoot,
    });
    const workerEnvironment = createSandboxWorkerEnvironment(
      options.environment ?? process.env,
    );
    const dockerArguments = buildRunscDockerArguments({
      ...configuration,
      environment: workerEnvironment,
      workspacePath,
    });
    const spawnProcess = options.spawnProcess ?? spawn;

    this.#runtime = new ProcessAgentRuntime({
      workspacePath,
      workerWorkspacePath: CONTAINER_WORKSPACE_PATH,
      environment: workerEnvironment,
      launchWorker: () => spawnProcess(
        configuration.dockerCommand,
        dockerArguments,
        {
          cwd: workspacePath,
          env: createDockerClientEnvironment(options.environment ?? process.env),
          stdio: ["pipe", "pipe", "pipe"],
        },
      ),
    });
  }

  handleThreadMessage(input) {
    return this.#runtime.handleThreadMessage(input);
  }

  stop() {
    return this.#runtime.stop();
  }
}

export async function assertRunscAvailable(options = {}) {
  const configuration = normalizeRunscConfiguration(options);
  const run = options.execFile ?? execFileAsync;
  let runtimes;
  try {
    const result = await run(configuration.dockerCommand, [
      "info",
      "--format",
      "{{json .Runtimes}}",
    ]);
    runtimes = JSON.parse(String(result.stdout).trim());
  } catch (error) {
    throw new Error(
      `Cannot inspect Docker runtimes with ${configuration.dockerCommand}.`,
      { cause: error },
    );
  }
  if (!runtimes || typeof runtimes !== "object" || !("runsc" in runtimes)) {
    throw new Error("Docker runtime runsc is required for production agents.");
  }

  try {
    await run(configuration.dockerCommand, [
      "image",
      "inspect",
      configuration.image,
    ]);
  } catch (error) {
    throw new Error(
      `Workspace runtime image is unavailable: ${configuration.image}`,
      { cause: error },
    );
  }

  try {
    await run(configuration.dockerCommand, [
      "network",
      "inspect",
      configuration.network,
    ]);
  } catch (error) {
    throw new Error(
      `Sandbox network is unavailable: ${configuration.network}`,
      { cause: error },
    );
  }
}

export function readRunscConfiguration(environment = process.env) {
  return normalizeRunscConfiguration({
    dockerCommand: environment.HESWE_DOCKER_COMMAND,
    image: environment.HESWE_WORKSPACE_IMAGE,
    network: environment.HESWE_SANDBOX_NETWORK,
    userId: environment.HESWE_SANDBOX_UID,
    groupId: environment.HESWE_SANDBOX_GID,
    cpus: environment.HESWE_SANDBOX_CPUS,
    memory: environment.HESWE_SANDBOX_MEMORY,
    pidsLimit: environment.HESWE_SANDBOX_PIDS_LIMIT,
  });
}

export function buildRunscDockerArguments(options) {
  const configuration = normalizeRunscConfiguration(options);
  const workspaceId = normalizeWorkspaceId(options.workspaceId);
  const workspacePath = path.resolve(options.workspacePath);
  if (workspacePath.includes(",")) {
    throw new Error("Workspace paths containing commas cannot be mounted.");
  }

  const environmentArguments = Object.entries(options.environment ?? {})
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([name, value]) => ["--env", `${name}=${value}`]);

  return [
    "run",
    "--rm",
    "--interactive",
    "--runtime",
    "runsc",
    "--name",
    `heswe-workspace-${workspaceId}`,
    "--hostname",
    "heswe-workspace",
    "--read-only",
    "--user",
    `${configuration.userId}:${configuration.groupId}`,
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges=true",
    "--network",
    configuration.network,
    "--cpus",
    configuration.cpus,
    "--memory",
    configuration.memory,
    "--pids-limit",
    configuration.pidsLimit,
    "--ulimit",
    "nofile=1024:1024",
    "--tmpfs",
    "/tmp:rw,nosuid,nodev,size=256m,mode=1777",
    "--mount",
    `type=bind,source=${workspacePath},target=${CONTAINER_WORKSPACE_PATH}`,
    "--workdir",
    CONTAINER_WORKSPACE_PATH,
    ...environmentArguments,
    configuration.image,
    "--workspace",
    CONTAINER_WORKSPACE_PATH,
  ];
}

export function validateWorkspaceMount(input) {
  const workspaceId = normalizeWorkspaceId(input.workspaceId);
  const requestedRoot = path.resolve(
    requireString(input.workspaceRoot, "workspaceRoot"),
  );
  const requestedWorkspace = path.resolve(
    requireString(input.workspacePath, "workspacePath"),
  );
  if (
    fs.lstatSync(requestedRoot).isSymbolicLink()
    || fs.lstatSync(requestedWorkspace).isSymbolicLink()
  ) {
    throw new Error("Workspace roots and directories cannot be symlinks.");
  }
  const workspaceRoot = fs.realpathSync(requestedRoot);
  const workspacePath = fs.realpathSync(requestedWorkspace);

  if (
    path.dirname(workspacePath) !== workspaceRoot
    || path.basename(workspacePath) !== workspaceId
  ) {
    throw new Error(
      "Sandbox workspace must be the fixed direct child of the workspace root.",
    );
  }
  return requestedWorkspace;
}

function normalizeRunscConfiguration(options) {
  const image = requireString(options.image, "HESWE_WORKSPACE_IMAGE");
  const network = requireString(options.network, "HESWE_SANDBOX_NETWORK");
  if (["bridge", "host", "none"].includes(network)) {
    throw new Error("HESWE_SANDBOX_NETWORK must name a dedicated Docker network.");
  }
  return {
    ...(options.workspaceId === undefined
      ? {}
      : { workspaceId: normalizeWorkspaceId(options.workspaceId) }),
    dockerCommand: optionalString(options.dockerCommand) ?? DEFAULT_DOCKER_COMMAND,
    image,
    network,
    userId: normalizePositiveInteger(
      options.userId ?? "10001",
      "HESWE_SANDBOX_UID",
    ),
    groupId: normalizePositiveInteger(
      options.groupId ?? "10001",
      "HESWE_SANDBOX_GID",
    ),
    cpus: normalizePositiveNumber(options.cpus ?? "2", "HESWE_SANDBOX_CPUS"),
    memory: optionalString(options.memory) ?? "2g",
    pidsLimit: normalizePositiveInteger(
      options.pidsLimit ?? "256",
      "HESWE_SANDBOX_PIDS_LIMIT",
    ),
  };
}

function createSandboxWorkerEnvironment(source) {
  const environment = { HESWE_AGENT_WORKER: "1" };
  for (const name of SANDBOX_ENV_NAMES) {
    if (typeof source[name] === "string") {
      environment[name] = source[name];
    }
  }
  return environment;
}

function createDockerClientEnvironment(source) {
  const environment = {};
  for (const name of DOCKER_ENV_NAMES) {
    if (typeof source[name] === "string") {
      environment[name] = source[name];
    }
  }
  return environment;
}

function normalizeWorkspaceId(value) {
  const id = requireString(value, "workspaceId");
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/.test(id)) {
    throw new Error("Invalid sandbox workspaceId.");
  }
  return id;
}

function normalizePositiveInteger(value, name) {
  const normalized = requireString(String(value), name);
  if (!/^[1-9][0-9]*$/.test(normalized)) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return normalized;
}

function normalizePositiveNumber(value, name) {
  const normalized = requireString(String(value), name);
  const number = Number(normalized);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${name} must be positive.`);
  }
  return normalized;
}

function requireString(value, name) {
  const normalized = optionalString(value);
  if (!normalized || normalized.startsWith("-")) {
    throw new Error(`${name} is required.`);
  }
  return normalized;
}

function optionalString(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}
