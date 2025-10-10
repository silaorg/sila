import type { LangMessage, LangContentPart } from "aiwrapper";
import { LangMessages } from "aiwrapper";
import { ChatAgent } from "./chatAgent";
import { AgentServices } from "./AgentServices";
import { ChatAppData } from "@sila/core";
import type { ThreadMessage } from "../models";
import type { AppConfig } from "../models";
import type { ThreadMessageWithResolvedFiles } from "../models";
import type { AttachmentPreview } from "../spaces/files";
import { splitModelString } from "../utils/modelUtils";
import type { AppTree } from "../spaces/AppTree";

export type ChatStreamingEvent = {
  type: "streaming";
  data: LangMessages;
}

/**
 * A wrapper around a chat agent (from aiwrapper) that handles vertices in the app tree and 
 * decides when to reply
 */
export class WrapChatAgent {
  private chatAgent: ChatAgent;
  private isRunning = false;

  constructor(private data: ChatAppData, private agentServices: AgentServices, private appTree: AppTree) {
    // Instantiate an agent
    this.chatAgent = new ChatAgent();
  }

  /**
   * We use the same agent convention with a "run" method that starts the agent
   */
  run() {
    // Initial check: if the last message is by the user, reply
    this.maybeReplyToLatest();

    // Subscribe to new messages (text or attachments)
    this.data.observeMessages(() => {
      this.maybeReplyToLatest();
    });
  }

  private async maybeReplyToLatest(): Promise<void> {
    if (this.isRunning) return;
    const vertices = this.data.messageVertices;
    if (vertices.length === 0) return;

    const last = vertices[vertices.length - 1];
    const role = this.data.getMessageRole(last.id);
    if (role !== "user") return;
    if (!this.data.isLastMessage(last.id)) return;

    this.isRunning = true;
    try {
      await this.reply(vertices.map(v => v.getAsTypedObject<ThreadMessage>()));
    } finally {
      this.isRunning = false;
    }
  }

  private async reply(messages: ThreadMessage[]): Promise<void> {
    // Resolve config
    let config: AppConfig | undefined = this.data.configId ?
      this.agentServices.space.getAppConfig(this.data.configId) : undefined;

    if (!config) {
      config = this.agentServices.space.getAppConfig("default");
      if (config) {
        this.data.configId = "default";
      }
    }

    if (!config) {
      throw new Error("No config found");
    }

    // Create assistant placeholder and set in progress
    const assistantMsg = await this.data.newMessage("assistant");
    assistantMsg.inProgress = true;
    
    // Prefill model info if explicitly set and not 'auto'
    if (config.targetLLM && !config.targetLLM.endsWith("auto")) {
      const parts = splitModelString(config.targetLLM);
      if (parts) {
        assistantMsg.modelProvider = parts.providerId;
        assistantMsg.modelId = parts.modelId;
      }
    }

    try {
      const lang = await this.agentServices.lang(config.targetLLM);
      const resolvedModel = this.agentServices.getLastResolvedModel();

      // Build system prompt
      let systemPrompt = (config.instructions || "");
      systemPrompt += "\n\n" +
        "Preferably use markdown for formatting. If you write code examples: use tick marks for inline code and triple tick marks for code blocks." +
        "\n\n" +
        "For math, use TeX with inline $ ... $ and block $$ ... $$ delimiters. If you want to show the source of TeX - wrap it in a code block" +
        "\n\n" +
        "Current date and time " + new Date().toLocaleString();
      if (resolvedModel) {
        systemPrompt += `\n\n[Meta] Model: ${resolvedModel.provider}/${resolvedModel.model}`;
      }
      if (config.name) {
        systemPrompt += `\n[Meta] Assistant Config: ${config.name}`;
      }

      const supportsVision = true;

      const remap = async (m: ThreadMessage): Promise<LangMessage> => {
        const normalizedRole = (m.role === "assistant" ? "assistant" : "user") as "assistant" | "user";
        const hasFiles = Array.isArray(m.files) && m.files.length > 0;
        if (!hasFiles) {
          return { role: normalizedRole, content: m.text || "" } as LangMessage;
        }

        const resolved: ThreadMessageWithResolvedFiles = await this.data.resolveMessageFiles(m);
        const images = resolved.files?.filter((f) => f?.kind === 'image') || [];
        const textFiles = resolved.files?.filter((f) => f?.kind === 'text') || [];

        if (supportsVision && images.length > 0) {
          const parts: LangContentPart[] = [];
          if (m.text && m.text.trim().length > 0) {
            parts.push({ type: 'text', text: m.text });
          }
          for (const tf of textFiles) {
            const content = this.extractTextFromDataUrl(tf.dataUrl);
            if (content) {
              parts.push({ type: 'text', text: `\n\n--- File: ${tf.name} ---\n` + content });
            }
          }
          for (const img of images) {
            const { base64, mimeType } = this.parseDataUrl(img.dataUrl);
            parts.push({ type: 'image', image: { kind: 'base64', base64, mimeType } });
          }
          return { role: normalizedRole, content: parts } as LangMessage;
        }

        let content = m.text || "";
        for (const tf of textFiles) {
          const t = this.extractTextFromDataUrl(tf.dataUrl);
          if (t) content += `\n\n--- File: ${tf.name} ---\n` + t;
        }
        if (images.length > 0) {
          const names = images.map((a) => a.name).filter(Boolean).join(', ');
          content += `\n\n[User attached ${images.length} image(s): ${names}]`;
        }
        return { role: normalizedRole, content } as LangMessage;
      };

      const langMessagesArr: LangMessage[] = [
        // @TODO: use instructions!
        { role: 'system', content: systemPrompt },
        ...await Promise.all(messages.map(remap)),
      ];
      // IMPORTANT: reset ChatAgent's internal state by passing a LangMessages instance
      const langMessages = new LangMessages(langMessagesArr);

      // Wire streaming updates
      const unsubscribe = this.chatAgent.subscribe((event) => {
        if (event.type === 'streaming') {
          const text = this.extractAnswerText(event.data);
          if (typeof text === 'string') {
            this.appTree.tree.setTransientVertexProperty(assistantMsg.id, 'text', text);
          }
        } else if (event.type === 'finished') {
          const final = this.extractAnswerText(event.output);
          if (typeof final === 'string') {
            assistantMsg.text = final;
          }
          assistantMsg.inProgress = false;

          const info = this.agentServices.getLastResolvedModel();
          if (info) {
            assistantMsg.modelProvider = info.provider;
            assistantMsg.modelId = info.model;
          }
        }
      });

      this.chatAgent.setLanguageProvider(lang);
      await this.chatAgent.run(langMessages);
      unsubscribe();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      assistantMsg.role = 'error';
      assistantMsg.text = msg;
      assistantMsg.inProgress = false;
    }
  }

  // @TODO: huh? seems retarted; how about we make .answer a getter that takes the last message; rename it to lastAnswer
  private extractAnswerText(messages: LangMessages): string | undefined {
    // Try common paths first
    if (messages && typeof messages.answer === 'string') return messages.answer;
    // If result is LangMessages, try the last assistant message content
    try {
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (m?.role === 'assistant') {
          const c = m.content;
          if (typeof c === 'string') return c;
          if (Array.isArray(c)) {
            // concatenate text parts
            const txt = c.filter((p: any) => p?.type === 'text').map((p: any) => p.text).join('');
            if (txt) return txt;
          }
          break;
        }
      }
    } catch { }
    return undefined;
  }

  private parseDataUrl(dataUrl: string): { base64: string; mimeType?: string } {
    try {
      const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
      if (match && match[2]) {
        return { mimeType: match[1], base64: match[2] };
      }
    } catch { }
    return { base64: dataUrl };
  }

  private extractTextFromDataUrl(dataUrl: string | undefined): string | null {
    if (!dataUrl) return null;
    try {
      const textDataUrlMatch = dataUrl.match(/^data:(text\/[^;]+);base64,(.+)$/);
      if (!textDataUrlMatch) return null;
      const [, , base64] = textDataUrlMatch;
      const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    } catch {
      return null;
    }
  }

}