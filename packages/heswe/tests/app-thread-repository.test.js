import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ThreadStore } from "../src/thread-store.js";
import { AppThreadRepository } from "../src/app/app-thread-repository.js";

test("thread details and summary use the same history snapshot", async (t) => {
  const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "thread-repository-"));
  t.after(() => fs.rm(workspacePath, { recursive: true, force: true }));
  let reads = 0;
  class ChangingStore extends ThreadStore {
    async loadEvents() {
      reads++;
      return [{ type: "message", message: {
        role: "user", items: [{ type: "text", text: `snapshot ${reads}` }],
      } }];
    }
  }
  const repository = new AppThreadRepository(workspacePath, new ChangingStore());
  const thread = await repository.create("user", "A thread");
  const detail = await repository.get("user", thread.id);
  assert.equal(reads, 1);
  assert.equal(detail.summary.preview, detail.events[0].message.items[0].text);
  assert.equal(detail.summary.messageCount, 1);
});
