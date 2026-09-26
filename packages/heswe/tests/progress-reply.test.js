import assert from "node:assert/strict";
import { test } from "node:test";
import { createProgressReply } from "../src/channels/progress-reply.js";

test("createProgressReply creates one message and edits it through completion", async () => {
  const calls = [];
  const reply = createProgressReply({
    async send(text) {
      calls.push(["send", text]);
      return "message-1";
    },
    async update(id, text) {
      calls.push(["update", id, text]);
    },
  });

  await Promise.all([reply.start(), reply.start()]);
  await reply.sendWorking({ text: "Checking files" });
  await reply.sendFinal("Done");

  assert.deepEqual(calls, [
    ["send", "🤔 Thinking..."],
    ["update", "message-1", "🔄 Working...\n\nChecking files"],
    ["update", "message-1", "Done"],
  ]);
});

test("createProgressReply sends standalone replies when messages cannot be edited", async () => {
  const sent = [];
  const reply = createProgressReply({
    async send(text) {
      sent.push(text);
      return null;
    },
    async update() {
      throw new Error("should not update");
    },
  });

  await reply.sendWorking({ text: "" });
  await reply.sendFinal("Done");

  assert.deepEqual(sent, ["🤔 Thinking...", "🔄 Working...", "Done"]);
});

test("createProgressReply sends the final answer directly when progress never started", async () => {
  const sent = [];
  const reply = createProgressReply({
    async send(text) {
      sent.push(text);
      return null;
    },
    async update() {},
  });

  await reply.sendFinal("Done");

  assert.deepEqual(sent, ["Done"]);
});
