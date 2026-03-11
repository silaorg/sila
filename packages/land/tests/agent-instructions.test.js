import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { defaultSlackInstructions } from "../src/agent-runtime/index.js";
import { loadLandAgentInstructions } from "../src/agent-instructions.js";

test("loadLandAgentInstructions overrides default base instructions with custom files", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "silaland-instructions-"));
  const landPath = path.join(tempRoot, "land");
  const instructionsDir = path.join(landPath, "agents", "default", "instructions");

  await fs.mkdir(path.join(instructionsDir, "team"), { recursive: true });
  await fs.writeFile(path.join(instructionsDir, "01-core.md"), "Custom instructions.\n", "utf8");
  await fs.writeFile(path.join(instructionsDir, "team", "02-style.txt"), "Follow team style.\n", "utf8");

  const instructions = await loadLandAgentInstructions(landPath, "slack");
  assert.equal(instructions.includes("You're an assistant for the user."), false);
  assert.match(instructions, /<formatting>/);
  assert.match(instructions, /Use Slack mrkdwn syntax/);
  assert.match(instructions, /<environment>/);
  assert.match(
    instructions,
    /<instruction src="agents\/default\/instructions\/01-core\.md">Custom instructions\.\n<\/instruction>/,
  );
  assert.match(
    instructions,
    /<instruction src="agents\/default\/instructions\/team\/02-style\.txt">Follow team style\.\n<\/instruction>/,
  );
  assert.ok(
    instructions.indexOf("instructions/01-core.md") < instructions.indexOf("instructions/team/02-style.txt"),
  );
  assert.ok(instructions.indexOf("instructions/team/02-style.txt") < instructions.indexOf("<environment>"));
});

test("loadLandAgentInstructions falls back to default instructions", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "silaland-instructions-"));
  const landPath = path.join(tempRoot, "land");

  const instructions = await loadLandAgentInstructions(landPath, "slack");
  assert.equal(instructions, defaultSlackInstructions());
});

test("loadLandAgentInstructions ignores binary files in custom instructions directory", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "silaland-instructions-"));
  const landPath = path.join(tempRoot, "land");
  const instructionsDir = path.join(landPath, "agents", "default", "instructions");

  await fs.mkdir(instructionsDir, { recursive: true });
  await fs.writeFile(path.join(instructionsDir, "base.md"), "Text instruction.\n", "utf8");
  await fs.writeFile(path.join(instructionsDir, "logo.bin"), Buffer.from([0, 1, 2, 3]));

  const instructions = await loadLandAgentInstructions(landPath, "slack");
  assert.match(instructions, /<instruction src="agents\/default\/instructions\/base\.md">/);
  assert.equal(instructions.includes("logo.bin"), false);
});
