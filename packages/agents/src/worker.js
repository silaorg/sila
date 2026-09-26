#!/usr/bin/env node

import { createInterface } from "node:readline";
import { createAppAgentRuntime } from "heswe/app-agent-runtime";

const workspacePath = readWorkspacePath(process.argv.slice(2));
let runtimePromise = null;
let stopping = false;

console.log = (...args) => console.error(...args);
console.warn = (...args) => console.error(...args);

const lines = createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

lines.on("line", (line) => {
  void handleLine(line);
});

lines.on("close", () => {
  if (!stopping) {
    void stopRuntime().finally(() => {
      process.exitCode = 0;
    });
  }
});

async function handleLine(line) {
  let request;
  try {
    request = JSON.parse(line);
  } catch (error) {
    writeResponse("", false, undefined, error);
    return;
  }

  const requestId = typeof request?.id === "string" ? request.id : "";
  if (request?.type !== "request" || !requestId) {
    writeResponse(requestId, false, undefined, new Error("Invalid worker request."));
    return;
  }

  try {
    if (request.method === "handleThreadMessage") {
      const runtime = await getRuntime();
      const result = await runtime.handleThreadMessage({
        ...request.input,
        onAssistantLoopMessage: (payload) =>
          writeEvent(requestId, "assistant-loop-message", payload),
        onAssistantProgress: (payload) =>
          writeEvent(requestId, "assistant-progress", payload),
        onAssistantResponding: () =>
          writeEvent(requestId, "assistant-responding"),
      });
      writeResponse(requestId, true, result);
      return;
    }

    if (request.method === "stop") {
      stopping = true;
      await stopRuntime();
      writeResponse(requestId, true, { stopped: true });
      lines.close();
      process.exitCode = 0;
      return;
    }

    throw new Error(`Unsupported worker method: ${request.method}`);
  } catch (error) {
    writeResponse(requestId, false, undefined, error);
  }
}

function getRuntime() {
  if (!runtimePromise) {
    const pending = createAppAgentRuntime({ workspacePath });
    runtimePromise = pending;
    void pending.catch(() => {
      if (runtimePromise === pending) {
        runtimePromise = null;
      }
    });
  }
  return runtimePromise;
}

async function stopRuntime() {
  const pending = runtimePromise;
  runtimePromise = null;
  if (!pending) {
    return;
  }
  const runtime = await pending.catch(() => null);
  await runtime?.stop?.();
}

function writeEvent(requestId, name, payload) {
  writeProtocolMessage({
    type: "event",
    requestId,
    name,
    ...(payload === undefined ? {} : { payload }),
  });
}

function writeResponse(requestId, ok, result, error) {
  writeProtocolMessage({
    type: "response",
    requestId,
    ok,
    ...(ok ? { result } : { error: serializeError(error) }),
  });
}

function writeProtocolMessage(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function serializeError(error) {
  return {
    name: typeof error?.name === "string" ? error.name : "Error",
    message: typeof error?.message === "string"
      ? error.message
      : String(error ?? "Unknown agent worker error"),
    ...(typeof error?.stack === "string" ? { stack: error.stack } : {}),
    ...(typeof error?.code === "string" ? { code: error.code } : {}),
  };
}

function readWorkspacePath(args) {
  const workspaceIndex = args.indexOf("--workspace");
  const value = workspaceIndex >= 0 ? args[workspaceIndex + 1] : "";
  if (typeof value !== "string" || !value) {
    throw new Error("Agent worker requires --workspace.");
  }
  return value;
}
