import {
  Agent,
  ChatAgent,
  HttpRequestError,
  LangMessage,
  LangMessages,
} from "aiwrapper";
import { AgentServices } from "./AgentServices";
import { BindedVertex, ChatAppData } from "@sila/core";
import type { ThreadMessage } from "../models";
import type { AppConfig } from "../models";
import type { AttachmentPreview } from "../spaces/files";
import { FilesTreeData } from "../spaces/files";
import type { FileReference } from "../spaces/files/FileResolver";
import type { AppTree } from "../spaces/AppTree";
import {
  agentEnvironmentInstructions,
  agentFormattingInstructions,
  agentMetaInfo,
  agentToolUsageInstructions,
} from "./prompts/wrapChatAgentInstructions";
import { createWorkspaceProxyFetch } from "./tools/workspaceProxyFetch";
import {
  convertToLangMessage,
  extractTextFromDataUrl,
} from "./convertToLangMessage";
import { FileResolver } from "../spaces/files/FileResolver";

/**
 * A wrapper around a chat agent (from aiwrapper) that handles vertices in the app tree and
 * decides when to reply
 */
export class WrapChatAgent
  extends Agent<void, void, { type: "messageGenerated" }> {
  private chatAgent: ChatAgent;
  private isRunning = false;
  private pendingAssistantImages = new Map<
    string,
    Array<
      {
        dataUrl: string;
        mimeType?: string;
        name?: string;
        width?: number;
        height?: number;
      }
    >
  >();
  private stopEventUnsubscribe?: () => void;
  private fileResolver: FileResolver;
  private currentRun:
    | {
      abortController: AbortController;
      targetMessages: Array<BindedVertex<ThreadMessage>>;
      unsubscribe?: () => void;
    }
    | undefined;

  constructor(
    private data: ChatAppData,
    private agentServices: AgentServices,
    private appTree: AppTree,
  ) {
    super();
    this.chatAgent = new ChatAgent();
    this.fileResolver = new FileResolver(agentServices.space);
  }

  /**
   * We use the same agent convention with a "run" method that starts the agent
   */
  protected async runInternal() {
    // Listen for stop requests triggered by the UI
    if (!this.stopEventUnsubscribe) {
      this.stopEventUnsubscribe = this.appTree.onEvent("stop-message", () => {
        this.abortCurrentRun();
      });
    }

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
      const messages = vertices.map((v) => v.bind<ThreadMessage>());

      await this.reply(messages as ThreadMessage[]);
    } finally {
      this.isRunning = false;
    }
  }

  private async convertToLangMessages(
    messages: ThreadMessage[],
    supportsVision: boolean = true,
  ): Promise<LangMessage[]> {
    return await Promise.all(
      messages.map(async (m) =>
        await convertToLangMessage({
          message: m,
          data: this.data,
          fileResolver: this.fileResolver,
          supportsVision,
        })
      ),
    );
  }

  private async reply(messages: ThreadMessage[]): Promise<void> {
    // Resolve config
    let config: AppConfig | undefined = this.data.configId
      ? this.agentServices.space.getAppConfig(this.data.configId)
      : undefined;

    if (!config) {
      config = this.agentServices.space.getAppConfig("default");
      if (config) {
        this.data.configId = "default";
      }
    }

    if (!config) {
      throw new Error("No config found");
    }

    let targetMessages: BindedVertex<ThreadMessage>[] = [];
    try {
      const lang = await this.agentServices.lang(config.targetLLM);
      const resolvedModel = this.agentServices.getLastResolvedModel();

      const supportsVision = true;
      // Remap messages from vertices into LangMessage[]
      const langMessages = new LangMessages(
        await this.convertToLangMessages(messages, supportsVision),
      );

      const fetchForAgent = createWorkspaceProxyFetch(
        this.agentServices.space,
        this.appTree,
      );
      langMessages.availableTools = this.agentServices.getToolsForModel(
        resolvedModel,
        { fetchImpl: fetchForAgent, appTree: this.appTree },
      );

      // Add the assistant (config) instructions
      const instructions: string[] = config.instructions
        ? [config.instructions]
        : [];

      // Environment instructions
      instructions.push(agentEnvironmentInstructions());

      if (langMessages.availableTools.length > 0) {
        // Tool usage instructions
        instructions.push(
          agentToolUsageInstructions(langMessages.availableTools),
        );
      }

      // How to format messages
      instructions.push(agentFormattingInstructions());

      // Meta (context) for the agent to know the time, model, etc.
      const now = new Date();
      const localDateTime = now.toLocaleString();
      const utcIso = now.toISOString();
      instructions.push(
        agentMetaInfo({ localDateTime, utcIso, resolvedModel, config }),
      );

      langMessages.instructions = instructions.join("\n\n");

      let targetMsgCount = -1;
      let targetMsg: BindedVertex<ThreadMessage> | undefined;
      const unsubscribe = this.chatAgent.subscribe(async (event) => {
        if (event.type === "streaming") {
          const incomingMsg = event.data.msg;

          const isNewMsg = targetMsgCount !== event.data.idx;
          targetMsgCount = event.data.idx;
          if (isNewMsg) {
            if (targetMsg) {
              targetMsg.inProgress = false;
              if (targetMsg.role === "assistant") {
                targetMsg.text = incomingMsg.text;
              }

              // Finished previous message
            }

            targetMsg = this.data.newLangMessage(incomingMsg);
            targetMessages.push(targetMsg);
          }

          if (
            targetMsg &&
            (incomingMsg.role === "assistant" ||
              incomingMsg.role === "tool-results")
          ) {
            const contentText = incomingMsg.text;
            const toolRequests = incomingMsg.toolRequests ?? [];
            const toolResults = incomingMsg.toolResults ?? [];
            const reasoning = incomingMsg.reasoning;
            targetMsg.$useTransients((m) => {
              m.text = contentText;
              if (toolRequests.length > 0) {
                m.toolRequests = toolRequests.map((request) => ({
                  callId: request.callId,
                  name: request.name,
                  arguments: request.arguments,
                }));
              }
              if (toolResults.length > 0) {
                m.toolResults = toolResults.map((result) => ({
                  toolId: (result as any).toolId ?? result.callId ?? "",
                  name: result.name,
                  result: result.result,
                }));
              }
              if (reasoning) {
                // We call "reasoning" the "thinking" property
                m.thinking = reasoning;
              }
            });
            // Collect images during streaming; persist on finish
            this.collectAssistantImages(incomingMsg, targetMsg);
          }
        } else if (event.type === "finished") {
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
        } else if (event.type === "error") {
          // @TODO: should we do something here?
        } else if (event.type === "aborted") {
          for (const msg of targetMessages) {
            if (msg.inProgress) {
              msg.inProgress = false;
              msg.$commitTransients();
            }
          }
        }
      });

      this.chatAgent.setLanguageProvider(lang);

      const abortController = new AbortController();
      this.currentRun = { abortController, targetMessages, unsubscribe };

      await this.chatAgent.run(langMessages, {
        signal: abortController.signal,
      });

      unsubscribe();
      this.currentRun = undefined;
    } catch (error) {
      // Handle manual stop (AbortError). Mark in-progress messages as finished to unblock the UI.
      if ((error as any)?.name === "AbortError") {
        for (const msg of targetMessages) {
          if (msg.inProgress) {
            msg.inProgress = false;
          }
          this.pendingAssistantImages.delete(msg.id);
          msg.$commitTransients();
        }
        return;
      }

      let errorMessage = error instanceof Error ? error.message : String(error);

      if (error instanceof HttpRequestError) {
        if (error.body) {
          errorMessage = error.bodyText || errorMessage;
        }
      }

      await this.data.newMessage({ role: "error", text: errorMessage });
    } finally {
      if (this.currentRun?.unsubscribe) {
        this.currentRun.unsubscribe();
      }
      this.currentRun = undefined;
    }
  }

  private extractTextFromDataUrl(dataUrl: string | undefined): string | null {
    return extractTextFromDataUrl(dataUrl);
  }

  /** Extract image content parts from a LangMessage when content is an array */
  private extractImageParts(
    msg: LangMessage,
  ): Array<
    {
      dataUrl?: string;
      mimeType?: string;
      base64?: string;
      name?: string;
      width?: number;
      height?: number;
    }
  > {
    const result: Array<
      {
        dataUrl?: string;
        mimeType?: string;
        base64?: string;
        name?: string;
        width?: number;
        height?: number;
      }
    > = [];
    const items: any[] = Array.isArray((msg as any).items)
      ? (msg as any).items
      : [];
    for (const item of items) {
      if (!item || item.type !== "image") continue;
      if (typeof item.base64 === "string") {
        const mime = item.mimeType || "image/png";
        const dataUrl = `data:${mime};base64,${item.base64}`;
        result.push({
          dataUrl,
          mimeType: mime,
          base64: item.base64,
          name: item.metadata?.name,
          width: item.width,
          height: item.height,
        });
      } else if (typeof item.url === "string" && item.url.startsWith("data:")) {
        result.push({
          dataUrl: item.url,
          mimeType: item.mimeType,
          name: item.metadata?.name,
          width: item.width,
          height: item.height,
        });
      }
    }
    return result;
  }

  /** During streaming, collect assistant images as data URLs on the transient map (no disk I/O yet) */
  private collectAssistantImages(
    incomingMsg: LangMessage,
    targetMsg: BindedVertex<ThreadMessage>,
  ): void {
    try {
      const parts = this.extractImageParts(incomingMsg);
      if (!parts || parts.length === 0) return;
      const items = this.pendingAssistantImages.get(targetMsg.id) || [];
      for (const p of parts) {
        if (!p?.dataUrl) continue;
        // Simple in-memory dedupe by dataUrl string
        if (!items.some((x) => x.dataUrl === p.dataUrl)) {
          items.push({
            dataUrl: p.dataUrl,
            mimeType: p.mimeType,
            name: p.name,
            width: p.width,
            height: p.height,
          });
        }
      }
      this.pendingAssistantImages.set(targetMsg.id, items);
    } catch {
      // ignore
    }
  }

  /** On finish, persist collected assistant images and attach file refs once */
  private async persistPendingAssistantImages(
    targetMsg: BindedVertex<ThreadMessage>,
  ): Promise<void> {
    const items = this.pendingAssistantImages.get(targetMsg.id);
    if (!items || items.length === 0) return;
    this.pendingAssistantImages.delete(targetMsg.id);

    try {
      const store = this.agentServices.space.getFileStore();
      if (!store) return;

      const { targetTree, parentFolder } =
        await this.data.resolveFileTarget?.({ treeId: this.appTree.getId() }) ??
          {
            targetTree: this.appTree,
            parentFolder: this.appTree.tree.getVertexByPath("files") ||
              this.appTree.tree.root!.newNamedChild("files"),
          };

      const refs: FileReference[] = [];
      for (const part of items) {
        const put = await store.putDataUrl(part.dataUrl);
        const att: AttachmentPreview = {
          id: crypto.randomUUID(),
          kind: "image",
          name: part.name || "image",
          mimeType: part.mimeType || "image/png",
          size: put.size,
          dataUrl: part.dataUrl,
          width: part.width,
          height: part.height,
        };
        const fileVertex = FilesTreeData.saveFileInfoFromAttachment(
          parentFolder,
          att,
          put.hash,
        );
        refs.push({ tree: targetTree.getId(), vertex: fileVertex.id });
      }

      if (refs.length > 0) {
        targetMsg.$useTransients((m) => {
          const existing = Array.isArray(m.files)
            ? (m.files as any as FileReference[])
            : [];
          const existingSet = new Set(
            existing.map((r) => r.tree + ":" + r.vertex),
          );
          const uniqueToAdd = refs.filter((r) =>
            !existingSet.has(r.tree + ":" + r.vertex)
          );
          m.files = [...existing, ...uniqueToAdd];
        });
      }
    } catch {
      // ignore failures
    }
  }

  private abortCurrentRun(): void {
    const controller = this.currentRun?.abortController;
    if (controller && !controller.signal.aborted) {
      controller.abort();
    }
  }
}
