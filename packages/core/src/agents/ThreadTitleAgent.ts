import { ThreadMessage } from "../models";
import { Agent, AgentInput, AgentOutput } from "./Agent";
import { z } from "aiwrapper";
import { AppConfigForChat } from "./SimpleChatAgent";

export class ThreadTitleAgent extends Agent<AppConfigForChat> {
  // @TODO: decide if I can make input more specific for agents
  async input(
    payload: AgentInput,
    onStream?: (output: AgentOutput) => void,
  ): Promise<AgentOutput> {
    const {messages, title} = payload as { messages: ThreadMessage[], title: string };

    const lang = await this.services.lang(this.config.targetLLM);

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
    let finalTitle = answerObj?.title ?? result.answer?.trim() ?? title;

    // Post-process to ensure title follows conventions
    finalTitle = this.normalizeTitle(finalTitle);

    return { text: finalTitle };
  }

  private normalizeTitle(title: string): string {
    if (!title) return title;
    
    // Truncate if too long (max 30 characters)
    if (title.length > 30) {
      return title.substring(0, 27) + '...';
    }
    
    return title;
  }

  stop(): void {
    throw new Error("Method not implemented.");
  }
}
