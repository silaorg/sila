import { describe, it } from "node:test";
import { strictEqual } from "node:assert";
import {
  PTYShellSessionManager,
  looksInteractiveCommand,
  parseShellControlCommand,
} from "../../src/agent-runtime/pty-shell-session-manager.js";

describe("ptyShellSessionManager helpers", () => {
  it("parses shell control commands", () => {
    strictEqual(parseShellControlCommand("shell start"), "start");
    strictEqual(parseShellControlCommand("shell on"), "start");
    strictEqual(parseShellControlCommand("shell stop"), "stop");
    strictEqual(parseShellControlCommand("shell off"), "stop");
    strictEqual(parseShellControlCommand("shell reset"), "reset");
    strictEqual(parseShellControlCommand("shell status"), "status");
    strictEqual(parseShellControlCommand("echo hi"), null);
  });

  it("detects interactive command prefixes", () => {
    strictEqual(looksInteractiveCommand("vim test.txt"), true);
    strictEqual(looksInteractiveCommand("less README.md"), true);
    strictEqual(looksInteractiveCommand("htop"), true);
    strictEqual(looksInteractiveCommand("npm test"), false);
  });

  it("falls back from invalid numeric limits", () => {
    const manager = new PTYShellSessionManager({
      commandTimeoutMs: -1,
      idleTtlMs: Number.NaN,
      maxOutputBytes: 0,
    });

    strictEqual(manager.commandTimeoutMs > 0, true);
    strictEqual(manager.idleTtlMs > 0, true);
    strictEqual(manager.maxOutputBytes > 0, true);
  });
});
