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
  /** @type {string | number | null} */
  let messageId = null;
  /** @type {Promise<string | number | null> | null} */
  let starting = null;

  async function start() {
    if (messageId !== null) {
      return messageId;
    }
    if (!starting) {
      starting = transport.send("🤔 Thinking...").then((id) => {
        messageId = id;
        return id;
      });
    }
    return starting;
  }

  async function replaceOrSend(text) {
    const id = await start();
    if (id !== null) {
      await transport.update(id, text);
      return;
    }
    await transport.send(text);
  }

  return {
    start,
    async sendWorking(payload) {
      await replaceOrSend(formatWorkingMessage(payload.text));
    },
    async sendFinal(answer) {
      if (messageId !== null) {
        await transport.update(messageId, answer);
        return;
      }
      if (starting) {
        const id = await starting;
        if (id !== null) {
          await transport.update(id, answer);
          return;
        }
      }
      await transport.send(answer);
    },
  };
}
