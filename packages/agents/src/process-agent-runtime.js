import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_WORKER_PATH = fileURLToPath(new URL("./worker.js", import.meta.url));
const STOP_TIMEOUT_MS = 5_000;
const PASSTHROUGH_ENV_NAMES = Object.freeze([
  "ANTHROPIC_API_KEY",
  "COHERE_API_KEY",
  "DEEPSEEK_API_KEY",
  "EXA_API_KEY",
  "FAL_KEY",
  "GOOGLE_API_KEY",
  "GROQ_API_KEY",
  "KIMI_API_KEY",
  "MISTRAL_API_KEY",
  "OPENAI_API_KEY",
  "OPENROUTER_API_KEY",
  "PTY_COMMAND_TIMEOUT_MS",
  "PTY_IDLE_TTL_MS",
  "PTY_MAX_OUTPUT_BYTES",
  "PTY_SHELL",
  "REPO_ROOT",
  "SOURCE_PATH",
  "XAI_API_KEY",
  "HOME",
  "HTTPS_PROXY",
  "HTTP_PROXY",
  "LANG",
  "LC_ALL",
  "NO_PROXY",
  "PATH",
  "SHELL",
  "SSL_CERT_DIR",
  "SSL_CERT_FILE",
  "TEMP",
  "TERM",
  "TMP",
  "TMPDIR",
  "TZ",
]);

export class ProcessAgentRuntime {
  #workspacePath;
  #workerPath;
  #workerWorkspacePath;
  #environment;
  #launchWorker;
  #child = null;
  #exitPromise = null;
  #stdoutBuffer = "";
  #nextRequestId = 1;
  #pending = new Map();
  #stopping = false;

  constructor(options = {}) {
    if (typeof options.workspacePath !== "string" || !options.workspacePath) {
      throw new Error("ProcessAgentRuntime requires workspacePath.");
    }
    this.#workspacePath = path.resolve(options.workspacePath);
    this.#workerPath = path.resolve(options.workerPath ?? DEFAULT_WORKER_PATH);
    this.#workerWorkspacePath = path.resolve(
      options.workerWorkspacePath ?? this.#workspacePath,
    );
    this.#environment = createAgentWorkerEnvironment(
      options.environment ?? process.env,
    );
    const spawnProcess = options.spawnProcess ?? spawn;
    this.#launchWorker = options.launchWorker ?? ((input) =>
      spawnProcess(process.execPath, [
        input.workerPath,
        "--workspace",
        input.workspacePath,
      ], {
        cwd: this.#workspacePath,
        env: input.environment,
        stdio: ["pipe", "pipe", "pipe"],
      }));
  }

  async handleThreadMessage(input) {
    const threadDir = resolveWorkerThreadDir(
      this.#workspacePath,
      this.#workerWorkspacePath,
      input?.threadDir,
    );
    const callbacks = {
      onAssistantLoopMessage: input.onAssistantLoopMessage,
      onAssistantProgress: input.onAssistantProgress,
      onAssistantResponding: input.onAssistantResponding,
    };
    return this.#request("handleThreadMessage", {
      threadId: input.threadId,
      threadDir,
      userId: input.userId,
      text: input.text,
      publicText: input.publicText,
      attachments: input.attachments,
    }, callbacks);
  }

  async stop() {
    if (!this.#child) {
      return;
    }
    if (this.#stopping) {
      await this.#exitPromise;
      return;
    }

    this.#stopping = true;
    const child = this.#child;
    const exitPromise = this.#exitPromise;
    try {
      await this.#request("stop", {});
      child.stdin.end();
      await withTimeout(exitPromise, STOP_TIMEOUT_MS, "Agent worker did not stop.");
    } catch (error) {
      child.kill("SIGKILL");
      await exitPromise.catch(() => {});
      throw error;
    } finally {
      this.#stopping = false;
    }
  }

  #request(method, input, callbacks = {}) {
    if (this.#stopping && method !== "stop") {
      return Promise.reject(new Error("Agent worker is stopping."));
    }
    const child = this.#ensureChild();
    const id = String(this.#nextRequestId++);

    return new Promise((resolve, reject) => {
      this.#pending.set(id, {
        callbacks,
        eventQueue: Promise.resolve(),
        reject,
        resolve,
      });
      const message = `${JSON.stringify({
        type: "request",
        id,
        method,
        input,
      })}\n`;
      child.stdin.write(message, "utf8", (error) => {
        if (!error) return;
        const pending = this.#pending.get(id);
        if (!pending) return;
        this.#pending.delete(id);
        pending.reject(error);
      });
    });
  }

  #ensureChild() {
    if (this.#child) {
      return this.#child;
    }

    this.#stdoutBuffer = "";
    const child = this.#launchWorker({
      environment: this.#environment,
      workerPath: this.#workerPath,
      workspacePath: this.#workerWorkspacePath,
    });
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => this.#handleStdout(chunk));
    child.stderr.on("data", (chunk) => {
      process.stderr.write(`[agent ${path.basename(this.#workspacePath)}] ${chunk}`);
    });
    child.on("error", (error) => this.#fail(error));
    this.#exitPromise = new Promise((resolve) => {
      child.once("exit", (code, signal) => {
        if (this.#child === child) {
          this.#child = null;
          this.#exitPromise = null;
        }
        if (this.#pending.size) {
          const detail = signal ? `signal ${signal}` : `code ${code}`;
          this.#fail(new Error(`Agent worker exited with ${detail}.`));
        }
        resolve({ code, signal });
      });
    });
    this.#child = child;
    return child;
  }

  #handleStdout(chunk) {
    this.#stdoutBuffer += chunk;
    while (true) {
      const newlineIndex = this.#stdoutBuffer.indexOf("\n");
      if (newlineIndex < 0) {
        return;
      }
      const line = this.#stdoutBuffer.slice(0, newlineIndex);
      this.#stdoutBuffer = this.#stdoutBuffer.slice(newlineIndex + 1);
      if (!line.trim()) {
        continue;
      }
      let message;
      try {
        message = JSON.parse(line);
      } catch (error) {
        this.#fail(new Error(`Agent worker sent invalid JSON: ${error.message}`));
        this.#child?.kill("SIGKILL");
        return;
      }
      this.#handleMessage(message);
    }
  }

  #handleMessage(message) {
    const requestId = typeof message?.requestId === "string"
      ? message.requestId
      : "";
    const pending = this.#pending.get(requestId);
    if (!pending) {
      return;
    }

    if (message.type === "event") {
      pending.eventQueue = pending.eventQueue.then(async () => {
        if (message.name === "assistant-responding") {
          await pending.callbacks.onAssistantResponding?.();
          return;
        }
        if (message.name === "assistant-progress") {
          await pending.callbacks.onAssistantProgress?.(message.payload);
          return;
        }
        if (message.name === "assistant-loop-message") {
          await pending.callbacks.onAssistantLoopMessage?.(message.payload);
        }
      });
      return;
    }

    if (message.type !== "response") {
      return;
    }

    this.#pending.delete(requestId);
    pending.eventQueue.then(() => {
      if (message.ok) {
        pending.resolve(message.result);
        return;
      }
      pending.reject(deserializeError(message.error));
    }, pending.reject);
  }

  #fail(error) {
    const pendingRequests = Array.from(this.#pending.values());
    this.#pending.clear();
    for (const pending of pendingRequests) {
      pending.reject(error);
    }
  }
}

export function createAgentWorkerEnvironment(source = process.env) {
  const environment = {
    HESWE_AGENT_WORKER: "1",
  };
  for (const name of PASSTHROUGH_ENV_NAMES) {
    const value = source[name];
    if (typeof value === "string") {
      environment[name] = value;
    }
  }
  return environment;
}

function resolveWorkerThreadDir(workspacePath, workerWorkspacePath, value) {
  if (typeof value !== "string" || !value) {
    throw new Error("Agent threadDir must be inside its workspace.");
  }
  const threadDir = path.resolve(value);
  const relativePath = path.relative(workspacePath, threadDir);
  if (
    !relativePath
    || relativePath === ".."
    || relativePath.startsWith(`..${path.sep}`)
    || path.isAbsolute(relativePath)
  ) {
    throw new Error("Agent threadDir must be inside its workspace.");
  }
  return path.join(workerWorkspacePath, relativePath);
}

function deserializeError(value) {
  const message = typeof value?.message === "string"
    ? value.message
    : "Agent worker request failed.";
  const error = new Error(message);
  if (typeof value?.name === "string") {
    error.name = value.name;
  }
  if (typeof value?.stack === "string") {
    error.stack = value.stack;
  }
  if (typeof value?.code === "string") {
    error.code = value.code;
  }
  return error;
}

async function withTimeout(promise, timeoutMs, message) {
  let timeout;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
        timeout.unref?.();
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}
