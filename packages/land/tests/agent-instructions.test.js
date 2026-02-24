import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { defaultSlackInstructions } from "@sila/agents";
import { loadLandAgentInstructions } from "../src/agent-instructions.js";

test("loadLandAgentInstructions uses override file when present", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "silaland-instructions-"));
  const landPath = path.join(tempRoot, "land");
  const instructionsPath = path.join(landPath, "agents", "default", "instructions.md");

  await fs.mkdir(path.dirname(instructionsPath), { recursive: true });
  await fs.writeFile(instructionsPath, "Custom instructions.\n", "utf8");

  const instructions = await loadLandAgentInstructions(landPath, "slack");
  assert.match(instructions, /^Custom instructions\./);
  assert.match(instructions, /<formatting>/);
  assert.match(instructions, /Slack supports Markdown formatting/);
  assert.match(instructions, /<environment>/);
  assert.equal(instructions.includes("You're an assistant for the user."), false);
});

test("loadLandAgentInstructions falls back to default instructions", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "silaland-instructions-"));
  const landPath = path.join(tempRoot, "land");

  const instructions = await loadLandAgentInstructions(landPath, "slack");
  assert.equal(instructions, defaultSlackInstructions());
});
