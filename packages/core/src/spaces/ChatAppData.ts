import { type Vertex } from "reptree";
import type {Space } from "./Space";
import type { BindedVertex, VertexPropertyType } from "reptree";
import { ThreadMessage } from "../models";
import type { AppConfig, ThreadMessageWithResolvedFiles } from "../models";
import { AppTree } from "./AppTree";
import { FilesTreeData } from "./files";
import type { AttachmentPreview } from "./files";
import type { FileReference } from "./files/FileResolver";
import { LangMessage, ToolRequest, ToolResult } from "aiwrapper";

export class ChatAppData {

  static readonly ASSETS_ROOT_PATH = "assets";

  /** Logical path in the workspace or chat, e.g. "file:///assets/pic.png" or "file:notes.txt" */
  private root: Vertex;
  private referenceInSpace: Vertex;
  // @TODO temporary: support update callback for message edits/branch switching
  private updateCallbacks: Set<(vertices: Vertex[]) => void> = new Set();

  static createNewChatTree(space: Space, configId: string): AppTree {
    const tree = space.newAppTree("default-chat").tree;
    const root = tree.root;

    if (!root) {
      throw new Error("Root vertex not found");
    }

    root.setProperty("configId", configId);
    root.newNamedChild("messages");
    root.newNamedChild("jobs");

    return new AppTree(tree);
  }

  constructor(private space: Space, private appTree: AppTree) {
    const root = appTree.tree.root;

    if (!root) {
      throw new Error("Root vertex not found");
    }

    this.root = root;
    this.referenceInSpace = space.getVertexReferencingAppTree(root.id)!;
  }

  get messagesVertex(): Vertex | undefined {
    return this.appTree.tree.getVertexByPath("messages");
  }

  get configId(): string | undefined {
    return this.root.getProperty("configId") as string;
  }

  get configAppConfig(): AppConfig | undefined {
    const configId = this.configId;

    if (!configId) return undefined;

    const cfg = this.space.getAppConfig(configId);
    if (!cfg) return undefined;

    return cfg;
  }

  set configId(configId: string) {
    this.root.setProperty("configId", configId);
  }

  get title(): string | undefined {
    return this.root.name;
  }

  set title(title: string) {
    this.root.name = title;
    this.referenceInSpace.name = title;
  }

  rename(newTitle: string) {
    if (newTitle.trim() === "") return;

    this.title = newTitle;
    this.space.setAppTreeName(this.threadId, newTitle);
  }

  /**
   * Get all messages from the main branches
   */
  get messageVertices(): Vertex[] {
    const vs: Vertex[] = [];
    const start = this.messagesVertex;
    if (!start) return [];
    let current: Vertex = start;
    while (true) {
      const children: Vertex[] = current.children;
      if (children.length === 0) break;
      const next: Vertex =
        children.length === 1
          ? children[0]
          : (children.find((c: Vertex) => c.getProperty("main") === true) as Vertex) || children[0];
      vs.push(next);
      current = next;
    }
    return vs;
  }

  /**
   * Resolves file references in message files to data URLs
   * Used for UI rendering and AI consumption
   */
  async resolveMessageFiles(message: ThreadMessage): Promise<ThreadMessageWithResolvedFiles> {
    const fileRefs = message.files;
    if (!fileRefs || fileRefs.length === 0) {
      console.log('No files to resolve for message:', message.id);
      return message as ThreadMessageWithResolvedFiles;
    }

    const fileData = await this.space.fileResolver.getFileData(fileRefs);
    
    // Create a new message object with resolved files
    return {
      ...message,
      files: fileData,
    } as ThreadMessageWithResolvedFiles;
  }

  triggerEvent(eventName: string, data: any) {
    this.appTree.triggerEvent(eventName, data);
  }

  observe(callback: (data: Record<string, VertexPropertyType>) => void): () => void {
    callback(this.root.getProperties());

    return this.root.observe((_) => {
      callback(this.root.getProperties());
    });
  }

  observeMessages(callback: (vertices: Vertex[]) => void): () => void {
    // @TODO: observe NOT only new messages but also when messages are updated
    return this.appTree.tree.observeVertexMove((vertex, _) => {
      const text = vertex.getProperty("text");
      const files = vertex.getProperty("files");
      
      // Trigger callback if there's text OR if there are attachments (files)
      if (text || (files && Array.isArray(files) && files.length > 0)) {
        callback(this.messageVertices);
      }
    });
  }

  observeNewMessages(callback: (vertices: Vertex[]) => void): () => void {
    return this.appTree.tree.observeVertexMove((vertex, isNew) => {
      if (!isNew) {
        return;
      }

      const text = vertex.getProperty("text");
      const files = vertex.getProperty("files");
      
      /*
      // @NOTE: I commented it out because it caused new messages sometimes to be skipped
      // Trigger callback if there's text OR if there are attachments (files)
      if (text || (files && Array.isArray(files) && files.length > 0)) {
        
      }
      */

      callback(this.messageVertices);
    });
  }

  observeMessage(id: string, callback: (message: ThreadMessage) => void): () => void {
    const vertex = this.appTree.tree.getVertex(id);
    if (!vertex) {
      throw new Error(`Vertex ${id} not found`);
    }

    return this.appTree.tree.observeVertex(id, (vertex) => {
      callback(vertex.getAsTypedObject<ThreadMessage>());
    });
  }

  newLangMessage(langMessage: LangMessage, inProgress: boolean = true): BindedVertex<ThreadMessage> {
    const text = langMessage.text || "";
    const role = langMessage.role;

    const properties: Record<string, any> = {
      _n: "message",
      role,
      text,
      inProgress,
    };

    if (langMessage.meta) {
      properties.meta = langMessage.meta;
    }

    if (langMessage.reasoning) {
      properties.thinking = langMessage.reasoning;
    }

    // Ensure assistant messages created via streaming also carry assistant config info
    // so that the UI can show the assistant's name instead of a generic label.
    if (role === "assistant" && this.configId) {
      properties.configId = this.configId;
      const cfg = this.space.getAppConfig(this.configId);
      if (cfg) {
        properties.configName = cfg.name;
      }
    }

    const toolRequests = langMessage.toolRequests;
    if (toolRequests.length > 0) {
      properties.toolRequests = toolRequests.map((request) => ({
        callId: request.callId,
        name: request.name,
        arguments: request.arguments,
      })) as ToolRequest[];
    }

    const toolResults = langMessage.toolResults;
    if (toolResults.length > 0) {
      properties.toolResults = toolResults.map((result) => ({
        toolId: (result as any).toolId ?? result.callId ?? "",
        name: result.name,
        result: result.result,
      })) as ToolResult[];
    }

    const lastMsgVertex = this.getLastMsgParentVertex();
    const newMessageVertex = lastMsgVertex.newChild(properties);
    return newMessageVertex.bind<ThreadMessage>();
  }

  async newMessage(
    message: Partial<ThreadMessage> & { 
      role: "user" | "assistant" | "error" | "tool" | "tool-results";
      attachments?: Array<AttachmentPreview>;
      fileTarget?: { treeId?: string; path?: string; createParents?: boolean };
    }
  ): Promise<ThreadMessage> {
    const lastMsgVertex = this.getLastMsgParentVertex();

    const properties: Record<string, any> = {
      _n: "message",
      role: message.role,
    };

    if (message.text) {
      properties.text = message.text;
    }

    if (message.toolRequests) {
      properties.toolRequests = message.toolRequests;
    }

    if (message.toolResults) {
      properties.toolResults = message.toolResults;
    }

    // If this is an assistant message, attach the assistant config information so the UI can display
    // the proper assistant name instead of a generic label. This is especially important for demo
    // spaces that are created programmatically and therefore never go through ChatAppBackend where
    // these fields are normally populated.
    if (message.role === "assistant" && this.configId) {
      properties.configId = this.configId;
      const cfg = this.space.getAppConfig(this.configId);
      if (cfg) {
        properties.configName = cfg.name;
      }
    }

    if (message.thinking) {
      properties.thinking = message.thinking;
    }

    // If there are attachments, persist to CAS and build refs BEFORE creating the message
    if (message.attachments && message.attachments.length > 0) {
      const store = this.space.fileStore;
      if (!store) {
        throw new Error("FileStore is required to save attachments");
      }
      const { targetTree, parentFolder } = await this.resolveFileTarget(message.fileTarget);
      const refs: Array<FileReference> = [];
      for (const att of message.attachments) {
        if (att?.kind === 'image' && typeof att?.dataUrl === 'string') {
          // Images remain immutable (hash-based CAS)
          const put = await store.putDataUrl(att.dataUrl);
          const fileVertex = FilesTreeData.saveFileInfoFromAttachment(
            parentFolder,
            att,
            put.hash
          );
          refs.push({ tree: targetTree.getId(), vertex: fileVertex.id });
        } else if (att?.kind === 'text' && typeof att?.content === 'string') {
          // Text attachments are stored as mutable UUID-backed documents
          const textBytes = new TextEncoder().encode(att.content);
          const uuid = crypto.randomUUID();
          await store.putMutable(uuid, textBytes);
          const fileVertex = FilesTreeData.saveFileInfoFromAttachment(
            parentFolder,
            att,
            uuid
          );
          refs.push({ tree: targetTree.getId(), vertex: fileVertex.id });
        } else {
          throw new Error(`Unsupported attachment or missing content for kind '${att?.kind}'`);
        }
      }

      properties.files = refs;
    }

    const newMessageVertex = this.appTree.tree.newVertex(lastMsgVertex.id, properties);
    return newMessageVertex.bind<ThreadMessage>();
  }

  /** Resolve target app tree and parent folder for file saves based on optional fileTarget. Defaults to this chat tree under ASSETS_ROOT_PATH. */
  async resolveFileTarget(fileTarget?: { treeId?: string; path?: string; createParents?: boolean }): Promise<{ targetTree: AppTree; parentFolder: Vertex } > {
    // Default: save under the current chat tree at ASSETS_ROOT_PATH
    if (!fileTarget || (!fileTarget.treeId && !fileTarget.path)) {
      const targetTree = this.appTree;
      const parentFolder = this.ensureFolderPathInTree(targetTree, [ChatAppData.ASSETS_ROOT_PATH], true);
      return { targetTree, parentFolder };
    }

    // Targeted: load specified tree, ensure path (default to ASSETS_ROOT_PATH)
    const treeId = fileTarget.treeId ?? this.appTree.getId();
    const targetTree = await this.space.loadAppTree(treeId) as AppTree;
    if (!targetTree) {
      throw new Error(`Target app tree not found: ${treeId}`);
    }
    const rawPath = (fileTarget.path && fileTarget.path.trim() !== '') ? fileTarget.path : ChatAppData.ASSETS_ROOT_PATH;
    const segments = rawPath.split('/').filter(Boolean);
    const parentFolder = this.ensureFolderPathInTree(targetTree, segments, fileTarget.createParents !== false);
    return { targetTree, parentFolder };
  }

  getFilesRoot(createIfMissing: boolean = false): Vertex | undefined {
    const existing = this.appTree.tree.getVertexByPath(ChatAppData.ASSETS_ROOT_PATH) as Vertex | undefined;
    if (existing) {
      return existing;
    }

    if (!createIfMissing) {
      return undefined;
    }

    return this.ensureFolderPathInTree(this.appTree, [ChatAppData.ASSETS_ROOT_PATH], true);
  }

  hasStoredFiles(): boolean {
    const root = this.appTree.tree.getVertexByPath(ChatAppData.ASSETS_ROOT_PATH) as Vertex | undefined;
    return !!(root && root.children.length > 0);
  }

  /** Ensure a slash-separated path exists inside the given app tree, creating folders if allowed. Returns the final folder vertex. */
  private ensureFolderPathInTree(appTree: AppTree, segments: string[], createParents: boolean): Vertex {
    const root = appTree.tree.root!;
    let current: Vertex | undefined;
    // If first segment is ASSETS_ROOT_PATH, ensure a named child for consistency
    if (segments.length > 0 && segments[0] === ChatAppData.ASSETS_ROOT_PATH) {
      current = appTree.tree.getVertexByPath(ChatAppData.ASSETS_ROOT_PATH) as Vertex | undefined;
      if (!current) {
        if (!createParents) throw new Error(`Path segment '${ChatAppData.ASSETS_ROOT_PATH}' not found and createParents=false`);
        current = root.newNamedChild(ChatAppData.ASSETS_ROOT_PATH);
      }
      segments = segments.slice(1);
    } else {
      current = root;
    }
    if (!current) {
      throw new Error("Unexpected undefined current folder while ensuring path");
    }
    for (const seg of segments) {
      const children: Vertex[] = current!.children;
      const existing: Vertex | undefined = children.find((c: Vertex) => c.name === seg);
      if (existing) {
        current = existing;
      } else {
        if (!createParents) throw new Error(`Path segment '${seg}' not found and createParents=false`);
        current = current!.newNamedChild(seg) as Vertex;
      }
    }
    return current!;
  }

  /** Create a new message directly under a specific parent message vertex */
  newMessageUnder(parentVertexId: string, role: "user" | "assistant" | "error", text: string, thinking?: string): ThreadMessage {
    const parentVertex = this.appTree.tree.getVertex(parentVertexId);
    if (!parentVertex) throw new Error(`Parent vertex ${parentVertexId} not found`);

    const properties: Record<string, any> = {
      _n: "message",
      text,
      role,
    };

    if (role === "assistant" && this.configId) {
      properties.configId = this.configId;
      const cfg = this.space.getAppConfig(this.configId);
      if (cfg) {
        properties.configName = cfg.name;
      }
    }

    if (thinking) {
      properties.thinking = thinking;
    }

    const newMessageVertex = this.appTree.tree.newVertex(parentVertex.id, properties);
    const props = newMessageVertex.getProperties();
    return {
      id: newMessageVertex.id,
      ...props,
    } as ThreadMessage;
  }

  /** Returns the path of message vertices from the messages root to the target (inclusive) */
  getMessagePath(messageId: string): { vertices: Vertex[]; messages: ThreadMessage[] } {
    const target = this.appTree.tree.getVertex(messageId);
    if (!target) throw new Error(`Vertex ${messageId} not found`);

    // Climb up to the messages container
    const path: Vertex[] = [];
    let cur: Vertex | undefined = target;
    while (cur) {
      if (cur === this.messagesVertex) break;
      path.push(cur);
      cur = cur.parent as Vertex | undefined;
    }
    // If we haven't reached messages container, include until just below it
    path.reverse();
    const messages = path.map((v) => v.getAsTypedObject<ThreadMessage>());
    return { vertices: path, messages };
  }

  askForReply(messageId: string): void {
    /*
    this.appTree.tree.newVertex(this.jobsVertex.id, {
      _n: "job",
      type: "reply",
      messageId,
    });
    */
  }

  retryMessage(messageId: string): void {
    const errorVertex = this.appTree.tree.getVertex(messageId);
    if (!errorVertex) {
      throw new Error(`Message ${messageId} not found`);
    }

    // Find the closest user message on the path to root. That's the "last active" message
    // we want to retry from.
    let cursor: Vertex | undefined = errorVertex;
    let userVertex: Vertex | undefined = undefined;
    while (cursor && cursor !== this.messagesVertex) {
      const role = cursor.getProperty("role");
      if (role === "user") {
        userVertex = cursor;
        break;
      }
      cursor = cursor.parent as Vertex | undefined;
    }

    if (!userVertex) {
      // Nothing reasonable to retry from. Keep the thread untouched.
      return;
    }

    // Delete everything after the user message on the current main branch so that the user
    // message becomes the last leaf again.
    const toDelete: Vertex[] = [];
    let current: Vertex = userVertex;
    while (current.children.length > 0) {
      const children: Vertex[] = current.children;
      const next =
        children.length === 1
          ? children[0]!
          : children.find((c: Vertex) => c.getProperty("main") === true) ?? children[0]!;
      toDelete.push(next);
      current = next;
    }

    // Delete from leaf to root to avoid parent/child ordering issues.
    for (let i = toDelete.length - 1; i >= 0; i--) {
      this.appTree.tree.deleteVertex(toDelete[i]!.id);
    }

    // Notify UI subscribers and trigger the agent to re-check the latest message.
    this.updateCallbacks.forEach((cb) => cb(this.messageVertices));
    this.triggerEvent("retry-message", { userMessageId: userVertex.id, errorMessageId: messageId });
  }

  stopMessage(messageId: string): void {
    this.triggerEvent("stop-message", { messageId });
  }

  editMessage(messageVertexId: string, newText: string) {
    const vertex = this.appTree.tree.getVertex(messageVertexId);
    if (!vertex) throw new Error("Message " + messageVertexId + " not found");
    const parent = vertex.parent;
    if (!parent) throw new Error("Cannot edit root message");
    const props = vertex.getProperties();

    const newProps: Record<string, any> = {
      _n: "message",
      text: newText,
      role: props.role,
      main: true,
    };

    const newVertex = vertex.parent.newChild(newProps);
    const siblings = parent.children;

    for (const sib of siblings) {
      if (sib.id !== newVertex.id && sib.getProperty("main")) {
        sib.setProperty("main", false);
      }
    }
    // @TODO temporary: notify subscribers of message update for branch change
    this.updateCallbacks.forEach(cb => cb(this.messageVertices));
  }

  switchMain(childId: string): void {
    const child = this.appTree.tree.getVertex(childId);
    if (!child) throw new Error("Vertex " + childId + " not found");
    const parent = child.parent;
    if (!parent) return;
    for (const sib of parent.children) {
      sib.setProperty("main", sib.id === childId);
    }

    this.updateCallbacks.forEach(cb => cb(this.messageVertices));
  }

  private getLastMsgParentVertex(): Vertex {
    // Start from the messages container, creating it if needed
    const startVertex: Vertex = this.messagesVertex ??
      this.root.newNamedChild("messages");
    let targetVertex = startVertex;



    // Get the last message vertex following the 'main' branch
    while (targetVertex.children.length > 0) {
      const children: Vertex[] = targetVertex.children;
      if (children.length === 1) {
        targetVertex = children[0]!;
      } else {
        const mainChild: Vertex | undefined = children.find(c => c.getProperty("main") === true);
        targetVertex = mainChild ?? children[0]!;
      }
    }

    return targetVertex;
  }

  isLastMessage(messageId: string): boolean {
    const vertex = this.appTree.tree.getVertex(messageId);
    if (!vertex) {
      return false;
    }
    return vertex.children.length === 0;
  }

  isMessageInProgress(messageId: string): boolean {
    const vertex = this.appTree.tree.getVertex(messageId);
    if (!vertex) {
      return false;
    }

    return vertex.getProperty("inProgress") === true;
  }

  getMessageRole(messageId: string): "user" | "assistant" | undefined {
    const vertex = this.appTree.tree.getVertex(messageId);
    if (!vertex) {
      return undefined;
    }

    return vertex.getProperty("role") as "user" | "assistant";
  }

  getMessageProperty(messageId: string, property: string): any {
    const vertex = this.appTree.tree.getVertex(messageId);
    if (!vertex) {
      return undefined;
    }

    return vertex.getProperty(property);
  }

  get threadId(): string {
    return this.root.id;
  }

  /**
   * Temporary: subscribe to message updates (like edits and branch switches).
   * Will be replaced once RepTree supports update events.
   */
  onUpdate(callback: (vertices: Vertex[]) => void): () => void {
    this.updateCallbacks.add(callback);
    return () => this.updateCallbacks.delete(callback);
  }
}
