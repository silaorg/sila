import { describe, it } from "node:test";
import { strictEqual } from "node:assert";
import {
  looksInteractiveCommand,
  parseShellControlCommand,
} from "../src/pty-shell-session-manager.js";

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
});
