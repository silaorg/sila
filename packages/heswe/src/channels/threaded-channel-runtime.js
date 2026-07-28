import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { ThreadStore } from "../agent-runtime/thread-store.js";
import { enqueueSerialTask } from "../serial-task-queue.js";
import { saveThreadState } from "./channel-utils.js";

export class ThreadedChannelRuntime {
  /** @type {string} */
  #channelPath;
  /** @type {null | import("../agent-runtime/chat-agent-runtime.js").InProcessChatAgentRuntime} */
  #agentRuntime = null;
  /** @type {string} */
  #channelName;
  /** @type {ThreadStore} */
  #threadStore;
  /** @type {Map<string, Promise<unknown>>} */
  #processingThreads = new Map();

  /**
   * @param {{
   *  channelPath: string;
   *  channelName?: string;
   *  agentRuntime?: import("../agent-runtime/chat-agent-runtime.js").InProcessChatAgentRuntime | null;
   *  threadStore?: ThreadStore;
   * }} options
   */
  constructor(options) {
    this.#channelPath = options.channelPath;
    this.#channelName = options.channelName ?? path.basename(options.channelPath);
    this.#agentRuntime = options.agentRuntime ?? null;
    this.#threadStore = options.threadStore instanceof ThreadStore
      ? options.threadStore
      : new ThreadStore();
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

  async drain() {
    await Promise.allSettled(this.#processingThreads.values());
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
   *  onRespondStart?: () => Promise<void>;
   *  sendIntermediateReply?: (payload: { text: string; toolNames: string[] }) => Promise<void>;
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
      onAssistantResponding: input.onRespondStart,
      onAssistantLoopMessage: input.sendIntermediateReply,
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
      const deliveryId = randomUUID();
      await this.#threadStore.appendEvent(threadDir, {
        type: "delivery",
        deliveryId,
        channel: this.#channelName,
        status: "pending",
        text: result.answer,
      });
      try {
        await input.sendReply(result.answer, result);
        await this.#threadStore.appendEvent(threadDir, {
          type: "delivery",
          deliveryId,
          channel: this.#channelName,
          status: "sent",
        });
      } catch (error) {
        await this.#threadStore.appendEvent(threadDir, {
          type: "delivery",
          deliveryId,
          channel: this.#channelName,
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }

    return result;
  }
}
