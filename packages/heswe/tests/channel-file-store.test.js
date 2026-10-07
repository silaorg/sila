import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { storeSlackFile } from "../src/channels/slack/slack-file-store.js";
import { storeTelegramFile } from "../src/channels/telegram/telegram-file-store.js";

for (const channel of ["slack", "telegram"]) {
  test(`${channel} stores attachments under the thread date without overwriting files`, async (t) => {
    const threadDir = await fs.mkdtemp(path.join(os.tmpdir(), "heswe-attachments-"));
    t.after(() => fs.rm(threadDir, { recursive: true, force: true }));
    const input = {
      threadDir,
      originalName: "../report.txt",
      createdAt: new Date(2026, 9, 7),
    };
    const fileUrl = "https://example.test/attachment";
    const download = async (url, destinationPath) => {
      assert.equal(url, fileUrl);
      await fs.writeFile(destinationPath, "attachment");
    };
    const store = channel === "slack"
      ? () => storeSlackFile({
        ...input,
        fileUrl,
        botUserOAuthToken: "test-token",
        downloadFileToPath: ({ fileUrl, destinationPath, botUserOAuthToken }) => {
          assert.equal(botUserOAuthToken, "test-token");
          return download(fileUrl, destinationPath);
        },
      })
      : () => storeTelegramFile({
        ...input,
        fileId: "test-file",
        telegram: { getFileLink: async () => new URL(fileUrl) },
        downloadFileToPath: download,
      });

    const first = await store();
    const second = await store();
    const directory = path.join(threadDir, "files", "2026", "10", "07");
    assert.equal(first, path.join(directory, ".._report.txt"));
    assert.equal(second, path.join(directory, ".._report_1.txt"));
    assert.equal(await fs.readFile(first, "utf8"), "attachment");
    assert.equal(await fs.readFile(second, "utf8"), "attachment");
  });
}
