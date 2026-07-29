#!/usr/bin/env node

import { createInterface } from "node:readline";

const lines = createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

lines.on("line", (line) => {
  const request = JSON.parse(line);
  if (request.method === "handleThreadMessage") {
    if (request.input.text === "__crash__") {
      process.stdout.write('{"incomplete":', () => process.exit(17));
      return;
    }
    if (request.input.text === "__error__") {
      write({
        type: "response",
        requestId: request.id,
        ok: false,
        error: {
          name: "TestAgentError",
          message: "Agent request failed",
          code: "test_failure",
        },
      });
      return;
    }
    write({
      type: "event",
      requestId: request.id,
      name: "assistant-responding",
    });
    write({
      type: "event",
      requestId: request.id,
      name: "assistant-progress",
      payload: {
        text: "Working",
        toolNames: ["execute_command"],
        tools: [{
          name: "execute_command",
          arguments: { command: "pwd" },
        }],
      },
    });
    write({
      type: "response",
      requestId: request.id,
      ok: true,
      result: {
        responded: true,
        answer: request.input.text,
        leakedApiSecret: Boolean(process.env.BETTER_AUTH_SECRET),
        hasProviderKey: process.env.OPENAI_API_KEY === "provider-key",
      },
    });
    return;
  }

  if (request.method === "stop") {
    write({
      type: "response",
      requestId: request.id,
      ok: true,
      result: { stopped: true },
    });
    lines.close();
    process.exitCode = 0;
  }
});

function write(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}
