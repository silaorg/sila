import fs from "node:fs/promises";
import path from "node:path";
import { enqueueSerialTask, saveThreadState } from "./channel-utils.js";

export class ThreadedChannelRuntime {
  /** @type {string} */
  #channelPath;
  /** @type {null | import("../agent-runtime/chat-agent-runtime.js").InProcessChatAgentRuntime} */
  #agentRuntime = null;
  /** @type {Map<string, Promise<void>>} */
  #processingThreads = new Map();

  /**
   * @param {{ channelPath: string; agentRuntime?: import("../agent-runtime/chat-agent-runtime.js").InProcessChatAgentRuntime | null }} options
   */
  constructor(options) {
    this.#channelPath = options.channelPath;
    this.#agentRuntime = options.agentRuntime ?? null;
  }

  /**
   * @param {import("../agent-runtime/chat-agent-runtime.js").InProcessChatAgentRuntime | null} agentRuntime
   */
  setAgentRuntime(agentRuntime) {
    this.#agentRuntime = agentRuntime ?? null;
  }

  clear() {
    this.#processingThreads.clear();
    this.#agentRuntime = null;
  }

  /**
   * @param {string} threadId
   * @param {() => Promise<void>} task
   */
  async enqueue(threadId, task) {
    await enqueueSerialTask(this.#processingThreads, threadId, task);
  }

  /**
   * @param {{
   *  thread: { threadId: string };
   *  userId: string;
   *  text: string;
   *  agentInput?: Record<string, unknown>;
   *  state?: Record<string, unknown> | ((input: {
   *    thread: { threadId: string };
   *    threadDir: string;
   *    userId: string;
   *    text: string;
   *    result: { responded: boolean; answer: string };
   *  }) => Record<string, unknown> | Promise<Record<string, unknown>>);
   *  sendReply?: (answer: string, result: { responded: boolean; answer: string }) => Promise<void>;
   * }} input
   * @returns {Promise<null | { responded: boolean; answer: string }>}
   */
  async handleThreadMessage(input) {
    if (!this.#agentRuntime) {
      return null;
    }

    const threadDir = path.join(this.#channelPath, input.thread.threadId);
    await fs.mkdir(threadDir, { recursive: true });

    const result = await this.#agentRuntime.handleThreadMessage({
      threadId: input.thread.threadId,
      threadDir,
      userId: input.userId,
      text: input.text,
      ...input.agentInput,
    });

    if (input.state) {
      const state = typeof input.state === "function"
        ? await input.state({
          thread: input.thread,
          threadDir,
          userId: input.userId,
          text: input.text,
          result,
        })
        : input.state;
      await saveThreadState(threadDir, state);
    }

    if (result.responded && result.answer && typeof input.sendReply === "function") {
      await input.sendReply(result.answer, result);
    }

    return result;
  }
}
