import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { SlackChannel } from "../src/channels/slack-channel.js";

test("slack runtime can upload files through send_slack_file callback", async () => {
  const { channelPath, landPath } = await createLandFixture();
  const mockApp = createMockSlackApp();
  const sentFilePath = path.join(landPath, "assets", "report.txt");
  await fs.mkdir(path.dirname(sentFilePath), { recursive: true });
  await fs.writeFile(sentFilePath, "report", "utf8");

  const channel = new SlackChannel(
    channelPath,
    {
      channel: "slack",
      enabled: true,
      botUserOAuthToken: "xoxb-test",
      appLevelToken: "xapp-test",
    },
    {
      async createSlackApp() {
        return mockApp;
      },
      createAgentRuntime() {
        return {
          async handleThreadMessage(input) {
            await input.sendSlackFile?.({
              path: sentFilePath,
              title: "Weekly report",
              comment: "Generated file",
            });
            return { responded: false, answer: "" };
          },
          async stop() {},
        };
      },
    },
  );

  await channel.run();
  await mockApp.emitMessage({
    channel: "C111",
    user: "U123",
    text: "send report",
    thread_ts: "1710000000.123456",
  });
  await channel.stop();

  assert.equal(mockApp.uploadCalls.length, 1);
  assert.deepEqual(mockApp.uploadCalls[0], {
    channel_id: "C111",
    file: sentFilePath,
    thread_ts: "1710000000.123456",
    title: "Weekly report",
    initial_comment: "Generated file",
  });
  assert.equal(mockApp.postedMessages.length, 0);
});

async function createLandFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "silaland-slack-channel-"));
  const landPath = path.join(root, "land");
  const channelPath = path.join(landPath, "channels", "slack");

  await fs.mkdir(channelPath, { recursive: true });
  await fs.writeFile(path.join(landPath, ".env"), "OPENAI_API_KEY=sk-test\n", "utf8");
  return { root, landPath, channelPath };
}

function createMockSlackApp() {
  /** @type {null | ((input: { message: any }) => Promise<void>)} */
  let messageHandler = null;
  const uploadCalls = [];
  const postedMessages = [];

  return {
    uploadCalls,
    postedMessages,
    client: {
      auth: {
        async test() {
          return { user_id: "U_BOT" };
        },
      },
      files: {
        async uploadV2(input) {
          uploadCalls.push(input);
          return { files: [{ id: "F123", permalink: "https://example.test/file/F123" }] };
        },
      },
      chat: {
        async postMessage(input) {
          postedMessages.push(input);
        },
      },
    },
    message(handler) {
      messageHandler = handler;
    },
    async start() {},
    async stop() {},
    async emitMessage(message) {
      if (!messageHandler) {
        throw new Error("Missing Slack message handler");
      }
      await messageHandler({ message });
    },
  };
}
