import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { spawn as spawnPty } from "node-pty";

const DEFAULT_TIMEOUT_MS = Number(process.env.PTY_COMMAND_TIMEOUT_MS || 120000);
const DEFAULT_IDLE_TTL_MS = Number(process.env.PTY_IDLE_TTL_MS || 30 * 60 * 1000);
const DEFAULT_MAX_OUTPUT_BYTES = Number(process.env.PTY_MAX_OUTPUT_BYTES || 256 * 1024);
const DEFAULT_DEFAULT_CWD = process.cwd();

const DEFAULT_SESSION_ENV = {
  TERM: "dumb",
  PAGER: "cat",
  GIT_PAGER: "cat",
  NO_COLOR: "1",
  CI: "1",
  EDITOR: "true",
  VISUAL: "true",
};

const require = createRequire(import.meta.url);
let spawnHelperPrepared = false;

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findTokenLineIndex(buffer, token) {
  let offset = 0;
  while (offset < buffer.length) {
    const index = buffer.indexOf(token, offset);
    if (index === -1) return -1;
    const before = index === 0 ? "\n" : buffer[index - 1];
    const after = index + token.length >= buffer.length ? "\n" : buffer[index + token.length];
    const beforeOk = before === "\n" || before === "\r";
    const afterOk = after === "\n" || after === "\r";
    if (beforeOk && afterOk) return index;
    offset = index + token.length;
  }
  return -1;
}

function uniqueId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function stripAnsi(text) {
  return text.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "");
}

function truncateByBytes(text, maxBytes) {
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes <= maxBytes) {
    return { text, truncated: false };
  }

  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const slice = text.slice(0, mid);
    if (Buffer.byteLength(slice, "utf8") <= maxBytes) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return { text: text.slice(0, low), truncated: true };
}

function getShell() {
  return process.env.PTY_SHELL || "/bin/bash";
}

function getShellArgs(shellPath) {
  const name = path.basename(shellPath);
  if (name === "bash") return ["--noprofile", "--norc"];
  if (name === "zsh") return ["-f"];
  return [];
}

function escapeForSingleQuotedShell(text) {
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, `'\"'\"'`)
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

function ensureSpawnHelperExecutable() {
  if (spawnHelperPrepared) return;
  spawnHelperPrepared = true;

  if (process.platform !== "darwin") return;

  try {
    const nodePtyEntry = require.resolve("node-pty");
    const helperPath = path.resolve(
      path.dirname(nodePtyEntry),
      "..",
      "prebuilds",
      `${process.platform}-${process.arch}`,
      "spawn-helper",
    );

    if (!fs.existsSync(helperPath)) return;

    const mode = fs.statSync(helperPath).mode & 0o777;
    if ((mode & 0o111) === 0) {
      fs.chmodSync(helperPath, 0o755);
    }
  } catch {
    // Best effort.
  }
}

export class PTYShellSessionManager {
  constructor(options = {}) {
    this.defaultCwd = options.defaultCwd || DEFAULT_DEFAULT_CWD;
    this.commandTimeoutMs = options.commandTimeoutMs || DEFAULT_TIMEOUT_MS;
    this.idleTtlMs = options.idleTtlMs || DEFAULT_IDLE_TTL_MS;
    this.maxOutputBytes = options.maxOutputBytes || DEFAULT_MAX_OUTPUT_BYTES;
    /** @type {Map<string, any>} */
    this.sessions = new Map();
  }

  hasSession(sessionId) {
    return this.sessions.has(String(sessionId));
  }

  getStatus(sessionId) {
    const key = String(sessionId);
    const session = this.sessions.get(key);
    if (!session) {
      return { running: false };
    }

    const idleMs = Math.max(0, Date.now() - session.lastUsedAt);
    return {
      running: true,
      cwd: session.cwd,
      busy: session.busy,
      idleSeconds: Math.floor(idleMs / 1000),
      ttlSeconds: Math.floor(this.idleTtlMs / 1000),
    };
  }

  startSession(sessionId) {
    const key = String(sessionId);
    const existing = this.sessions.get(key);
    if (existing) {
      this.touchSession(existing);
      return { status: "already_running", cwd: existing.cwd, shell: existing.pty.process };
    }

    ensureSpawnHelperExecutable();

    const shellPath = getShell();
    const pty = spawnPty(shellPath, getShellArgs(shellPath), {
      name: "xterm-256color",
      cwd: this.defaultCwd,
      cols: 120,
      rows: 30,
      env: { ...process.env, ...DEFAULT_SESSION_ENV },
    });

    const session = {
      sessionId: key,
      pty,
      cwd: this.defaultCwd,
      lastUsedAt: Date.now(),
      busy: false,
      idleTimer: null,
      pending: null,
    };

    pty.onData((data) => this.onPtyData(session, data));
    pty.onExit(() => this.onPtyExit(session));

    pty.write(
      "stty -echo 2>/dev/null || true; unset PROMPT_COMMAND; export PS1=''; export PROMPT=''; export RPROMPT=''\n",
    );

    this.sessions.set(key, session);
    this.touchSession(session);
    return { status: "started", cwd: session.cwd, shell: pty.process };
  }

  stopSession(sessionId, reason = "manual") {
    const key = String(sessionId);
    const session = this.sessions.get(key);
    if (!session) {
      return { status: "not_running" };
    }

    this.clearIdleTimer(session);

    if (session.pending) {
      this.finishPending(session, {
        error: `PTY session stopped (${reason})`,
        exitCode: 130,
        stdout: "",
        stderr: "",
        cwd: session.cwd,
        truncated: false,
        timedOut: false,
      });
    }

    try {
      session.pty.kill();
    } catch {
      // Ignore kill errors.
    }

    this.sessions.delete(key);
    return { status: "stopped", reason };
  }

  resetSession(sessionId) {
    this.stopSession(sessionId, "reset");
    const started = this.startSession(sessionId);
    return { status: "reset", cwd: started.cwd, shell: started.shell };
  }

  async stopAll() {
    const keys = [...this.sessions.keys()];
    for (const key of keys) {
      this.stopSession(key, "shutdown");
    }
  }

  async execute(sessionId, command) {
    const key = String(sessionId);
    const session = this.sessions.get(key);
    if (!session) {
      throw new Error('PTY session is not running. Use "shell start" first.');
    }
    if (session.busy || session.pending) {
      throw new Error("PTY session is busy with another command. Try again in a moment.");
    }

    this.touchSession(session);
    session.busy = true;

    const commandId = uniqueId();
    const startToken = `__SILA_CMD_START_${commandId}__`;
    const endToken = `__SILA_CMD_END_${commandId}__`;
    const escapedCommand = escapeForSingleQuotedShell(command);

    return new Promise((resolve) => {
      const timeoutTimer = setTimeout(() => {
        this.finishPending(session, {
          stdout: "",
          stderr: `Command timed out after ${this.commandTimeoutMs}ms`,
          exitCode: 124,
          cwd: session.cwd,
          truncated: false,
          timedOut: true,
        });
        this.resetSession(key);
      }, this.commandTimeoutMs);

      session.pending = {
        startToken,
        endToken,
        buffer: "",
        timeoutTimer,
        resolve,
      };

      const wrapped =
        `__SILA_ESC='${escapedCommand}'; ` +
        `__SILA_CMD="$(printf '%b' "$__SILA_ESC")"; ` +
        `printf '\\n${startToken}\\n'; ` +
        `eval "$__SILA_CMD"; ` +
        `__SILA_EXIT=$?; ` +
        `__SILA_CWD="$(pwd -P 2>/dev/null || pwd)"; ` +
        `printf '\\n${endToken}:%s:%s\\n' "$__SILA_EXIT" "$__SILA_CWD"; ` +
        `unset __SILA_ESC __SILA_CMD __SILA_EXIT __SILA_CWD`;

      session.pty.write(`${wrapped}\n`);
    });
  }

  onPtyData(session, data) {
    if (!session.pending) return;

    const pending = session.pending;
    pending.buffer += data;

    const startIndex = findTokenLineIndex(pending.buffer, pending.startToken);
    if (startIndex === -1) {
      return;
    }

    const afterStart = pending.buffer.slice(startIndex + pending.startToken.length);
    const endPattern = new RegExp(
      `(?:^|\\r?\\n)${escapeRegExp(pending.endToken)}:([0-9-]+):(.*?)(?:\\r?\\n|$)`,
    );
    const endMatch = endPattern.exec(afterStart);
    if (!endMatch) {
      return;
    }

    const rawOutput = afterStart.slice(0, endMatch.index);
    const exitCode = Number(endMatch[1]) || 0;
    const cwd = (endMatch[2] || "").trim() || session.cwd;

    session.cwd = cwd;
    this.touchSession(session);

    const cleaned = stripAnsi(rawOutput).replace(/\r/g, "").replace(/^\n+/, "").trimEnd();
    const truncated = truncateByBytes(cleaned, this.maxOutputBytes);

    this.finishPending(session, {
      stdout: truncated.text,
      stderr: "",
      exitCode,
      cwd,
      truncated: truncated.truncated,
      timedOut: false,
    });
  }

  onPtyExit(session) {
    if (session.pending) {
      this.finishPending(session, {
        stdout: "",
        stderr: "PTY session terminated unexpectedly",
        exitCode: 1,
        cwd: session.cwd,
        truncated: false,
        timedOut: false,
      });
    }
    this.clearIdleTimer(session);
    this.sessions.delete(session.sessionId);
  }

  finishPending(session, result) {
    if (!session.pending) return;
    const pending = session.pending;
    clearTimeout(pending.timeoutTimer);
    session.pending = null;
    session.busy = false;
    pending.resolve(result);
  }

  touchSession(session) {
    session.lastUsedAt = Date.now();
    this.clearIdleTimer(session);
    session.idleTimer = setTimeout(() => {
      if (session.busy) {
        this.touchSession(session);
        return;
      }
      this.stopSession(session.sessionId, "idle_ttl");
    }, this.idleTtlMs);
    session.idleTimer.unref?.();
  }

  clearIdleTimer(session) {
    if (!session.idleTimer) return;
    clearTimeout(session.idleTimer);
    session.idleTimer = null;
  }
}

export function parseShellControlCommand(command) {
  const normalized = String(command || "").trim().toLowerCase();
  if (normalized === "shell start" || normalized === "shell on") return "start";
  if (normalized === "shell stop" || normalized === "shell off") return "stop";
  if (normalized === "shell reset") return "reset";
  if (normalized === "shell status") return "status";
  return null;
}

export function looksInteractiveCommand(command) {
  const firstWord = String(command || "")
    .trim()
    .split(/\s+/)[0]
    ?.toLowerCase();
  if (!firstWord) return false;
  return ["vim", "nvim", "nano", "less", "more", "htop", "top", "man"].includes(firstWord);
}
