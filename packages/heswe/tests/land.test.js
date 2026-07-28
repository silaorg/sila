import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { Land } from "../src/land.js";

test("Land.run rejects invalid config instead of running with an undefined name", async () => {
  const landPath = await fs.mkdtemp(path.join(os.tmpdir(), "heswe-land-"));
  await fs.writeFile(path.join(landPath, "config.json"), "{invalid", "utf8");

  const land = new Land(landPath);
  await assert.rejects(land.run(), /Invalid JSON/);
  await assert.rejects(land.run(), /Invalid JSON/);
  assert.equal(land.name, "");
});

test("Land.run rejects malformed channel config instead of silently skipping it", async () => {
  const landPath = await fs.mkdtemp(path.join(os.tmpdir(), "heswe-land-"));
  const channelPath = path.join(landPath, "channels", "slack");
  await fs.mkdir(channelPath, { recursive: true });
  await fs.writeFile(
    path.join(landPath, "config.json"),
    `${JSON.stringify({ version: 1, name: "broken-channel" })}\n`,
    "utf8",
  );
  await fs.writeFile(path.join(channelPath, "config.json"), "{invalid", "utf8");

  const land = new Land(landPath);
  await assert.rejects(land.run(), /Invalid JSON.*channels.*slack/);
});
