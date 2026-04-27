import {
  LanguageProvider,
  LangMessages,
  type LangMessage,
  type LangOptions,
} from "aiwrapper";

type MockLanguageProviderOptions = {
  model?: string;
  responsePrefix?: string;
  delayMs?: number;
};

const DEFAULT_RESPONSE_PREFIX = "Mock response:";

export class MockLanguageProvider extends LanguageProvider {
  private responsePrefix: string;
  private delayMs: number;

  constructor(options: MockLanguageProviderOptions = {}) {
    super(options.model ?? "mock-1");
    this.responsePrefix = options.responsePrefix ?? DEFAULT_RESPONSE_PREFIX;
    this.delayMs = options.delayMs ?? 350;
  }

  async ask(prompt: string, options?: LangOptions): Promise<LangMessages> {
    const messages = new LangMessages();
    messages.addUserMessage(prompt);
    return this.chat(messages, options);
  }

  async chat(
    messages: LangMessage[] | LangMessages,
    options?: LangOptions,
  ): Promise<LangMessages> {
    const conversation = new LangMessages(messages);
    const lastUser = [...conversation].reverse().find((msg) => msg.role === "user");
    const prompt = lastUser?.text?.trim() ?? "";

    if (this.delayMs > 0) {
      await this.delay(options?.signal);
    }

    if (options?.signal?.aborted) {
      conversation.aborted = true;
      return conversation;
    }

    const responseText = prompt
      ? `${this.responsePrefix} ${prompt}`
      : `${this.responsePrefix} Hello from the mock provider.`;

    conversation.addAssistantMessage(responseText);
    conversation.finished = true;

    const lastMessage = conversation[conversation.length - 1];
    if (lastMessage) {
      options?.onResult?.(lastMessage);
    }

    return conversation;
  }

  private async delay(signal?: AbortSignal): Promise<void> {
    if (!signal) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
      return;
    }

    if (signal.aborted) {
      return;
    }

    await new Promise<void>((resolve) => {
      const timeoutId = setTimeout(() => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      }, this.delayMs);

      const onAbort = () => {
        clearTimeout(timeoutId);
        signal.removeEventListener("abort", onAbort);
        resolve();
      };

      signal.addEventListener("abort", onAbort);
    });
  }
}
