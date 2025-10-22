import { ThreadMessage } from "../models";
import { Agent } from "aiwrapper";
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

    const allMessagesInOneMessage = messages
      .map((m) => `**${m.role}**:\n${m.text}`)
      .join("\n\n\n");

    const prompt = [
      "Create or edit a concise title for the chat thread.",
      "Rules:",
      "- Read the provided message thread.",
      "- If there is an existing title and it's good, keep it.",
      "- Otherwise, propose a new short title (1–3 words).",
      "- No markdown or extra commentary.",
      "- Output strictly a JSON object with the following shape: {\"title\": \"...\"}.",
      "",
      `Current Title: ${title ?? ""}`,
      "",
      "Messages:",
      allMessagesInOneMessage,
    ].join("\n");

    const schema = z.object({ title: z.string() });

    const result = await lang.askForObject(prompt, schema);

    const answerObj = (result.object as { title: string } | null);
    const finalTitle = answerObj?.title ?? result.answer?.trim() ?? title ?? "Untitled";

    // Emit event when title is generated
    this.emit({ type: "titleGenerated" });

    return { title: finalTitle };
  }
}
