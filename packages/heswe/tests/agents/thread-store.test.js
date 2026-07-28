import { describe, it } from "node:test";
import { deepEqual, equal } from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { LangMessage } from "aiwrapper";
import { ThreadStore } from "../../src/agent-runtime/thread-store.js";

describe("ThreadStore", () => {
  it("saves and loads messages.jsonl", async () => {
    const threadDir = await fs.mkdtemp(path.join(os.tmpdir(), "thread-store-"));
    const store = new ThreadStore();
    const messages = [
      new LangMessage("user", [{ type: "text", text: "hello" }]),
      new LangMessage("assistant", [{ type: "text", text: "world" }], { openaiResponseId: "resp_1" }),
    ];

    await store.saveMessages(threadDir, messages);

    const loaded = await store.loadMessages(threadDir);
    equal(loaded.length, 2);
    equal(loaded[0].role, "user");
    equal(loaded[1].role, "assistant");
    equal(loaded[1].meta.openaiResponseId, "resp_1");
    deepEqual(loaded[0].items, [{ type: "text", text: "hello" }]);
  });

  it("loads legacy messages.json and migrates to messages.jsonl", async () => {
    const threadDir = await fs.mkdtemp(path.join(os.tmpdir(), "thread-store-"));
    const store = new ThreadStore();
    const legacyPath = path.join(threadDir, "messages.json");
    await fs.writeFile(
      legacyPath,
      `${JSON.stringify([{ role: "user", items: [{ type: "text", text: "legacy" }] }], null, 2)}\n`,
      "utf8",
    );

    const loaded = await store.loadMessages(threadDir);
    equal(loaded.length, 1);
    equal(loaded[0].items[0].text, "legacy");

    const jsonlRaw = await fs.readFile(path.join(threadDir, "messages.jsonl"), "utf8");
    const lines = jsonlRaw.trim().split("\n").map((line) => JSON.parse(line));
    equal(lines.length, 1);
    equal(lines[0].items[0].text, "legacy");
  });
});
