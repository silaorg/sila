import { ThreadMessage } from "../models";
import { Agent, LangMessages } from "aiwrapper";
import { z } from "aiwrapper";
import { AgentServices } from "./AgentServices";

export interface TitleAgentInput {
  messages: ThreadMessage[];
  title?: string;
}

export interface TitleAgentOutput {
  title: string;
}

export class ThreadTitleAgent extends Agent<TitleAgentInput, TitleAgentOutput, { type: "titleGenerated" }> {
  constructor(private agentServices: AgentServices, private config: { targetLLM?: string }) {
    super();
  }

  protected async runInternal(input: TitleAgentInput): Promise<TitleAgentOutput> {
    const { messages, title } = input;

    const lang = await this.agentServices.lang(this.config.targetLLM);

    // Keep only user/assistant with non-empty text, then take the last 20 of those
    const filteredByRole = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .filter((m) => (m.text ?? "").trim().length > 0);
    const filteredMessages = filteredByRole.slice(-20);

    const lastUserAndAssistantMessages = filteredMessages
      .map((m) => `**${m.role}**:\n${m.text}`)
      .join("\n\n");

    const schema = z.object({ title: z.string() });

    const messagesForTitleAgent = new LangMessages();
    messagesForTitleAgent.instructions = [
      "You create and edit concise titles for chat threads.",
      "Rules:",
      "- Read the provided messages.",
      "- If <currentTitle> exists and still reflects the messages, keep it unchanged. Don't do minor title changes.",
      "- Otherwise, propose a new title:",
      "  - Length: 1–4 words",
      "  - Style: Title Case.",
      "  - Language: match the user's message language.",
      "- Do NOT add markdown, tags, quotes, or commentary.",
      "- Output JSON matching schema { title: string } with just the title.",
      "",
      "Edge cases:",
      "- If messages are empty or generic greetings, keep the current title if present; else use \"New Chat\".",
      "\n",
      `<currentTitle>${title ?? ""}</currentTitle>`
    ].join("\n");

    messagesForTitleAgent.addUserMessage(`<messages>\n${lastUserAndAssistantMessages}\n</messages>`);

    const result = await lang.askForObject(messagesForTitleAgent, schema);
    const answerObj = (result.object as { title: string } | null);
    const finalTitle = answerObj?.title ?? result.answer?.trim() ?? title ?? "Untitled";

    // Emit event when title is generated
    this.emit({ type: "titleGenerated" });

    return { title: finalTitle };
  }
}
