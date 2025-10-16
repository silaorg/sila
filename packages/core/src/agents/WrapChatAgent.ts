import type { LangMessage, LangContentPart } from "aiwrapper";
import { LangMessages } from "aiwrapper";
import { ChatAgent } from "aiwrapper";
import { AgentServices } from "./AgentServices";
import { BindedVertex, ChatAppData } from "@sila/core";
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

    try {
      const lang = await this.agentServices.lang(config.targetLLM);
      const resolvedModel = this.agentServices.getLastResolvedModel();

      let instructions = (config.instructions || "");
      const now = new Date();
      const localDateTime = now.toLocaleString();
      const utcIso = now.toISOString();
      instructions += "\n\n<formatting>\n" +
        "Preferably use markdown for formatting. If you write code examples: use tick marks for inline code and triple tick marks for code blocks." +
        "\n\n" +
        "For math, use TeX with inline $ ... $ and block $$ ... $$ delimiters. If you want to show the source of TeX - wrap it in a code block" +
        "\n</formatting>";

      instructions += "\n\n<meta>";
      instructions += "\nCurrent local date and time: " + localDateTime;
      instructions += "\nCurrent UTC time (ISO): " + utcIso;
      if (resolvedModel) {
        instructions += `\nModel: ${resolvedModel.provider}/${resolvedModel.model}`;
      }
      instructions += `\nCurrent assistant (your) name: ${config.name}`;
      instructions += `\nEnvironment: Sila app (open alternative to ChatGPT where users own their data) - https://silain.com`;
      instructions += `\n</meta>`;

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
        ...await Promise.all(messages.map(remap)),
      ];

      const langMessages = new LangMessages(langMessagesArr);
      langMessages.instructions = instructions;

      let targetMsgCount = -1;
      let targetMsg: BindedVertex<ThreadMessage> | undefined;
      let targetMessages: BindedVertex<ThreadMessage>[] = [];
      const unsubscribe = this.chatAgent.subscribe((event) => {
        if (event.type === 'streaming') {
          const incomingMsg = event.data.msg;

          const isNewMsg = targetMsgCount != event.data.idx;
          targetMsgCount = event.data.idx;
          if (isNewMsg) {
            if (targetMsg) {
              targetMsg.inProgress = false;
              if (targetMsg.role === "assistant") {
                targetMsg.text = incomingMsg.content as string;
              }
            }

            targetMsg = this.data.newMessageFromAI(incomingMsg.role as "assistant" | "tool" | "tool-results");
            targetMessages.push(targetMsg);
          }

          if (incomingMsg.role === "assistant") {
            const content = incomingMsg.content as string;
            if (content && targetMsg) {
              targetMsg.useTransient(m => { 
                m.text = content;
              });
            }
          }

        } else if (event.type === 'finished') {
          for (const msg of targetMessages) {
            if (msg.inProgress) {
              msg.inProgress = false;
            }

            if (msg.role === "assistant") {
              msg.commitTransients();
            }

            const info = this.agentServices.getLastResolvedModel();
            if (info) {
              msg.modelProvider = info.provider;
              msg.modelId = info.model;
            }
          }
        }
      });

      this.chatAgent.setLanguageProvider(lang);

      langMessages.availableTools = this.agentServices.getToolsForModel(resolvedModel);

      await this.chatAgent.run(langMessages);

      unsubscribe();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);

      // @TODO: in this case, create a new message with role "error" and text "msg"
      /*
      assistantMsg.role = 'error';
      assistantMsg.text = msg;
      assistantMsg.inProgress = false;
      */
    }
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