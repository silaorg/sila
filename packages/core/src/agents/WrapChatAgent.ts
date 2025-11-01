import type { LangMessage, LangContentPart } from "aiwrapper";
import { Agent, LangMessages, HttpRequestError } from "aiwrapper";
import { ChatAgent } from "aiwrapper";
import { AgentServices } from "./AgentServices";
import { BindedVertex, ChatAppData } from "@sila/core";
import type { ThreadMessage } from "../models";
import type { AppConfig } from "../models";
import type { ThreadMessageWithResolvedFiles } from "../models";
import type { AttachmentPreview } from "../spaces/files";
import { FilesTreeData } from "../spaces/files";
import type { FileReference } from "../spaces/files/FileResolver";
import { splitModelString } from "../utils/modelUtils";
import type { AppTree } from "../spaces/AppTree";
import { chatAgentMetaInstructions, formattingInstructions } from "./prompts/wrapChatAgentInstructions";

/**
 * A wrapper around a chat agent (from aiwrapper) that handles vertices in the app tree and 
 * decides when to reply
 */
export class WrapChatAgent extends Agent<void, void, { type: "messageGenerated" }> {
  private chatAgent: ChatAgent;
  private isRunning = false;
  private pendingAssistantImages = new Map<string, Array<{ dataUrl: string; mimeType?: string; name?: string; width?: number; height?: number }>>();

  constructor(private data: ChatAppData, private agentServices: AgentServices, private appTree: AppTree) {
    super();
    this.chatAgent = new ChatAgent();
  }

  /**
   * We use the same agent convention with a "run" method that starts the agent
   */
  protected async runInternal() {
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
      const messages = vertices.map(v => v.bind<ThreadMessage>());

      await this.reply(messages as ThreadMessage[]);
    } finally {
      this.isRunning = false;
    }
  }

  private async convertToLangMessage(m: ThreadMessage, supportsVision: boolean = true): Promise<LangMessage> {
    const normalizedRole = (m.role === "assistant" ? "assistant" : "user") as "assistant" | "user";
    const hasFiles = Array.isArray(m.files) && m.files.length > 0;
    if (!hasFiles) {
      return { role: normalizedRole, content: m.text || "", meta: m.meta } as LangMessage;
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

    return {
      role: normalizedRole,
      content,
      meta: m.meta
    } as LangMessage;
  }

  private async convertToLangMessages(messages: ThreadMessage[], supportsVision: boolean = true): Promise<LangMessage[]> {
    return await Promise.all(messages.map(async (m) => await this.convertToLangMessage(m, supportsVision)));
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

      // Add the assistant (config) instructions
      let instructions = (config.instructions || "");

      const now = new Date();
      const localDateTime = now.toLocaleString();
      const utcIso = now.toISOString();

      // How to format messages
      instructions += "\n\n" + formattingInstructions();
      // Meta (context) for the agent to know the time, model, etc.
      instructions += "\n\n" + chatAgentMetaInstructions({ localDateTime, utcIso, resolvedModel, config });

      const supportsVision = true;

      // Remap messages from vertices into LangMessage[]
      const langMessages = new LangMessages(await this.convertToLangMessages(messages, supportsVision));
      langMessages.instructions = instructions;

      let targetMsgCount = -1;
      let targetMsg: BindedVertex<ThreadMessage> | undefined;
      let targetMessages: BindedVertex<ThreadMessage>[] = [];
      const unsubscribe = this.chatAgent.subscribe(async (event) => {
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

              // Finished previous message
            }

            targetMsg = this.data.newLangMessage(incomingMsg);
            targetMessages.push(targetMsg);
          }

          if (incomingMsg.role === "assistant" && targetMsg) {
            // Update text for string content; for arrays, also update text by concatenating text parts
            const c: any = incomingMsg.content as any;
            if (typeof c === 'string') {
              if (c) {
                targetMsg.$useTransients(m => {
                  m.text = c as string;
                });
              }
            } else if (Array.isArray(c)) {
              const textParts = (c as LangContentPart[]).filter(p => p?.type === 'text').map(p => (p as any).text).filter(Boolean);
              if (textParts.length > 0) {
                const combined = textParts.join('\n');
                targetMsg.$useTransients(m => {
                  m.text = combined;
                });
              }
              // Collect images during streaming; persist on finish
              this.collectAssistantImages(incomingMsg, targetMsg);
            }
          }

        } else if (event.type === 'finished') {
          for (const msg of targetMessages) {
            if (msg.inProgress) {
              msg.inProgress = false;
            }

            if (msg.role === "assistant") {
              const info = this.agentServices.getLastResolvedModel();
              if (info) {
                msg.modelProvider = info.provider;
                msg.modelId = info.model;
              }

              // Persist any collected assistant images and attach refs
              await this.persistPendingAssistantImages(msg);
            }

            msg.$commitTransients();
          }

          // Emit custom event when message generation is complete
          this.emit({ type: "messageGenerated" });
        }
      });

      this.chatAgent.setLanguageProvider(lang);

      langMessages.availableTools = this.agentServices.getToolsForModel(resolvedModel);

      await this.chatAgent.run(langMessages);

      unsubscribe();
    } catch (error) {
      let errorMessage = error instanceof Error ? error.message : String(error);
      
      if (error instanceof HttpRequestError) {
        if (error.body) {
          errorMessage = error.bodyText || errorMessage;
        }
      }

      await this.data.newMessage({ role: "error", text: errorMessage });
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

  /** Extract image content parts from a LangMessage when content is an array */
  private extractImageParts(msg: LangMessage): Array<{ dataUrl?: string; mimeType?: string; base64?: string; name?: string; width?: number; height?: number }> {
    const result: Array<{ dataUrl?: string; mimeType?: string; base64?: string; name?: string; width?: number; height?: number }> = [];
    const c: any = (msg as any).content;
    if (!Array.isArray(c)) return result;
    for (const part of c as LangContentPart[]) {
      if (part && (part as any).type === 'image') {
        const img: any = (part as any).image;
        if (!img) continue;
        if (img.kind === 'data_url' && typeof img.dataUrl === 'string') {
          result.push({ dataUrl: img.dataUrl, mimeType: img.mimeType, name: img.name, width: img.width, height: img.height });
        } else if (img.kind === 'base64' && typeof img.base64 === 'string') {
          const mime = img.mimeType || 'image/png';
          const dataUrl = `data:${mime};base64,${img.base64}`;
          result.push({ dataUrl, mimeType: mime, name: img.name, width: img.width, height: img.height });
        }
      }
    }
    return result;
  }

  /** During streaming, collect assistant images as data URLs on the transient map (no disk I/O yet) */
  private collectAssistantImages(incomingMsg: LangMessage, targetMsg: BindedVertex<ThreadMessage>): void {
    try {
      const parts = this.extractImageParts(incomingMsg);
      if (!parts || parts.length === 0) return;
      const items = this.pendingAssistantImages.get(targetMsg.id) || [];
      for (const p of parts) {
        if (!p?.dataUrl) continue;
        // Simple in-memory dedupe by dataUrl string
        if (!items.some(x => x.dataUrl === p.dataUrl)) {
          items.push({ dataUrl: p.dataUrl, mimeType: p.mimeType, name: p.name, width: p.width, height: p.height });
        }
      }
      this.pendingAssistantImages.set(targetMsg.id, items);
    } catch {
      // ignore
    }
  }

  /** On finish, persist collected assistant images and attach file refs once */
  private async persistPendingAssistantImages(targetMsg: BindedVertex<ThreadMessage>): Promise<void> {
    const items = this.pendingAssistantImages.get(targetMsg.id);
    if (!items || items.length === 0) return;
    this.pendingAssistantImages.delete(targetMsg.id);

    try {
      const store = this.agentServices.space.getFileStore();
      if (!store) return;

      const { targetTree, parentFolder } = await this.data.resolveFileTarget?.({ treeId: this.appTree.getId() })
        ?? { targetTree: this.appTree, parentFolder: this.appTree.tree.getVertexByPath('files') || this.appTree.tree.root!.newNamedChild('files') };

      const refs: FileReference[] = [];
      for (const part of items) {
        const put = await store.putDataUrl(part.dataUrl);
        const att: AttachmentPreview = {
          id: crypto.randomUUID(),
          kind: 'image',
          name: part.name || 'image',
          mimeType: part.mimeType || 'image/png',
          size: put.size,
          dataUrl: part.dataUrl,
          width: part.width,
          height: part.height,
        };
        const fileVertex = FilesTreeData.saveFileInfoFromAttachment(parentFolder, att, put.hash);
        refs.push({ tree: targetTree.getId(), vertex: fileVertex.id });
      }

      if (refs.length > 0) {
        targetMsg.$useTransients((m) => {
          const existing = Array.isArray(m.files) ? (m.files as any as FileReference[]) : [];
          const existingSet = new Set(existing.map(r => r.tree + ':' + r.vertex));
          const uniqueToAdd = refs.filter(r => !existingSet.has(r.tree + ':' + r.vertex));
          m.files = [...existing, ...uniqueToAdd];
        });
      }
    } catch {
      // ignore failures
    }
  }

}