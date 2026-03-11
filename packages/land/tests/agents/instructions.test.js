import { describe, it } from "node:test";
import { equal, match, ok } from "node:assert/strict";
import {
  defaultAgentInstructions,
  defaultSlackInstructions,
  defaultTelegramInstructions,
  getChannelFormattingInstructions,
} from "../../src/agent-runtime/instructions.js";

const PLATFORM_DISPLAY_NAMES = Object.freeze({
  darwin: "macOS",
  linux: "Linux",
  win32: "Windows",
});

function getExpectedOSName(platform = process.platform) {
  if (typeof platform !== "string" || platform.length === 0) {
    return "Unknown";
  }

  return PLATFORM_DISPLAY_NAMES[platform] ?? platform;
}

describe("getChannelFormattingInstructions", () => {
  it("returns Slack-specific formatting instructions", () => {
    const instructions = getChannelFormattingInstructions("slack");
    match(instructions, /Use Slack mrkdwn syntax/);
    match(instructions, /Do not use CommonMark bold/);
    match(instructions, /Do not use headings/);
  });

  it("returns Telegram-specific formatting instructions", () => {
    const instructions = getChannelFormattingInstructions("telegram");
    match(instructions, /Do not use Markdown or HTML formatting/);
  });

  it("returns default formatting for unknown channels", () => {
    const instructions = getChannelFormattingInstructions("sms");
    match(instructions, /Use plain text formatting by default/);
  });
});

describe("defaultAgentInstructions", () => {
  it("includes environment block", () => {
    const instructions = defaultAgentInstructions();
    match(instructions, /<environment>/);
    match(instructions, /You run on a computer, can use cli, explore the file system\./);
    match(instructions, new RegExp(`OS: ${getExpectedOSName()}\\.`));
    match(instructions, /Throwaway scratch files: prefer the OS temporary directory\./);
    ok(!instructions.includes("OS: {$OS}."), "instructions should not contain unresolved OS placeholder");
  });

  it("uses Slack formatting for Slack default instructions", () => {
    const instructions = defaultSlackInstructions();
    match(instructions, /Use Slack mrkdwn syntax/);
    match(instructions, /send_slack_file/);
    ok(instructions.includes("<formatting>"));
  });

  it("uses Telegram formatting for Telegram default instructions", () => {
    const instructions = defaultTelegramInstructions();
    match(instructions, /Telegram should be plain text/);
    match(instructions, /send_telegram_file/);
  });

  it("matches Slack helper with channel-based builder", () => {
    equal(defaultSlackInstructions(), defaultAgentInstructions({ channel: "slack" }));
  });
});
