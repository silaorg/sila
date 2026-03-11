import { exec } from "node:child_process";
import { promisify } from "node:util";
import { looksInteractiveCommand, parseShellControlCommand } from "../pty-shell-session-manager.js";

const execAsync = promisify(exec);

export function createToolExecuteCommand(options = {}) {
  const {
    sessionId,
    ptyManager,
    defaultCwd = process.cwd(),
  } = options;

  return {
    name: "execute_command",
    description: "Execute a terminal command. Use shell start/status/reset/stop for PTY mode.",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The command to execute.",
        },
      },
      required: ["command"],
    },
    handler: async ({ command }) => {
      const control = parseShellControlCommand(command);
      if (control && sessionId && ptyManager) {
        try {
          if (control === "start") {
            const started = ptyManager.startSession(sessionId);
            return { mode: "pty", shell: started.shell, status: started.status, cwd: started.cwd };
          }
          if (control === "stop") {
            const stopped = ptyManager.stopSession(sessionId, "manual");
            return { mode: "pty", ...stopped };
          }
          if (control === "reset") {
            const reset = ptyManager.resetSession(sessionId);
            return { mode: "pty", ...reset };
          }
          return { mode: "pty", ...ptyManager.getStatus(sessionId) };
        } catch (error) {
          return { mode: "pty", error: `Failed to handle shell command: ${error.message}` };
        }
      }

      if (sessionId && ptyManager && ptyManager.hasSession(sessionId)) {
        if (looksInteractiveCommand(command)) {
          return {
            mode: "pty",
            error: "Interactive terminal programs are blocked in PTY mode. Use non-interactive flags.",
          };
        }

        try {
          const result = await ptyManager.execute(sessionId, command);
          return {
            mode: "pty",
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode,
            cwd: result.cwd,
            truncated: result.truncated,
            timedOut: result.timedOut,
            ...(result.exitCode !== 0 ? { error: `Command failed with exit code ${result.exitCode}` } : {}),
          };
        } catch (error) {
          return { mode: "pty", error: error.message };
        }
      }

      try {
        const result = await execAsync(command, { cwd: defaultCwd, maxBuffer: 1024 * 1024 });
        return { mode: "stateless", stdout: result.stdout, stderr: result.stderr };
      } catch (error) {
        return { mode: "stateless", error: error.message };
      }
    },
  };
}
