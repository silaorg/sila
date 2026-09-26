import { Input } from "telegraf";

export class TelegramTransport {
  constructor(bot) {
    this.bot = bot;
  }

  sendMessage(chatId, text) {
    return this.bot.telegram.sendMessage(chatId, text);
  }

  updateMessage(chatId, messageId, text) {
    return this.bot.telegram.editMessageText(chatId, messageId, undefined, text);
  }

  async sendFile(chatId, payload) {
    const input = Input.fromLocalFile(payload.path);
    const extra = payload.caption ? { caption: payload.caption } : undefined;
    const method = {
      photo: "sendPhoto",
      video: "sendVideo",
      audio: "sendAudio",
      voice: "sendVoice",
      document: "sendDocument",
    }[payload.kind] ?? "sendDocument";
    const sent = await this.bot.telegram[method](chatId, input, extra);
    return { messageId: sent?.message_id ?? null };
  }
}
