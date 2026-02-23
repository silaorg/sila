import { describe, it } from "node:test";
import { equal, match, ok } from "node:assert/strict";
import {
  defaultAgentInstructions,
  defaultSlackInstructions,
  defaultTelegramInstructions,
  getChannelFormattingInstructions,
} from "../src/instructions.js";

describe("getChannelFormattingInstructions", () => {
  it("returns Slack-specific formatting instructions", () => {
    const instructions = getChannelFormattingInstructions("slack");
    match(instructions, /Slack supports Markdown formatting/);
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
  });

  it("uses Slack formatting for Slack default instructions", () => {
    const instructions = defaultSlackInstructions();
    match(instructions, /Slack supports Markdown formatting/);
    ok(instructions.includes("<formatting>"));
  });

  it("uses Telegram formatting for Telegram default instructions", () => {
    const instructions = defaultTelegramInstructions();
    match(instructions, /Telegram should be plain text/);
  });

  it("matches Slack helper with channel-based builder", () => {
    equal(defaultSlackInstructions(), defaultAgentInstructions({ channel: "slack" }));
  });
});
