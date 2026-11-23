import { formatWorkingMessage } from "./channel-utils.js";

/**
 * Manages the single editable progress message used by chat channels.
 *
 * @param {{
 *  send: (text: string) => Promise<string | number | null>;
 *  update: (id: string | number, text: string) => Promise<void>;
 * }} transport
 */
export function createProgressReply(transport) {
  /** @type {Promise<string | number | null> | null} */
  let initialMessage = null;

  async function start() {
    initialMessage ??= transport.send("🤔 Thinking...");
    return initialMessage;
  }

  async function updateOrSend(text, initialPost) {
    const id = await initialPost;
    if (id !== null) {
      await transport.update(id, text);
    } else {
      await transport.send(text);
    }
  }

  return {
    start,
    async sendWorking(payload) {
      return updateOrSend(formatWorkingMessage(payload.text), start());
    },
    sendFinal(answer) {
      return updateOrSend(answer, initialMessage);
    },
  };
}
