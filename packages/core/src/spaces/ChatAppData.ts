import type { Vertex } from "reptree";
import type {Space } from "./Space";
import type { VertexPropertyType } from "reptree";
import type { ThreadMessage, ThreadMessageWithResolvedFiles } from "../models";
import { AppTree } from "./AppTree";
import { FilesTreeData } from "./files";
import type { AttachmentPreview } from "./files";
import type { FileReference } from "./files/FileResolver";
import { FileResolver } from "./files/FileResolver";

export class ChatAppData {
  private root: Vertex;
  private referenceInSpace: Vertex;
  // @TODO temporary: support update callback for message edits/branch switching
  private updateCallbacks: Set<(vertices: Vertex[]) => void> = new Set();
  private fileResolver: FileResolver;

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
    this.fileResolver = new FileResolver(space);

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

  set configId(configId: string) {
    this.root.setProperty("configId", configId);
  }

  get title(): string | undefined {
    return this.root.getProperty("title") as string;
  }

  set title(title: string) {
    console.log("setting title", title);
    this.root.setProperty("title", title);
    this.referenceInSpace.setProperty("title", title);
  }

  rename(newTitle: string) {
    if (newTitle.trim() === "") return;

    this.title = newTitle;
    this.space.setAppTreeName(this.threadId, newTitle);
  }

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
    const fileRefs = (message as any).files as Array<FileReference>;
    if (!fileRefs || fileRefs.length === 0) {
      console.log('No files to resolve for message:', message.id);
      return message as ThreadMessageWithResolvedFiles;
    }

    const fileData = await this.fileResolver.getFileData(fileRefs);
    
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
      if (text) {
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
      if (text) {
        callback(this.messageVertices);
      }

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

  async newMessage(
    role: "user" | "assistant" | "error",
    text: string,
    thinking?: string,
    attachments?: Array<AttachmentPreview>,
    fileTarget?: { treeId?: string; path?: string; createParents?: boolean }
  ): Promise<ThreadMessage> {
    const lastMsgVertex = this.getLastMsgParentVertex();

    const properties: Record<string, any> = {
      _n: "message",
      createdAt: Date.now(),
      text,
      role,
    };

    // If this is an assistant message, attach the assistant config information so the UI can display
    // the proper assistant name instead of a generic label. This is especially important for demo
    // spaces that are created programmatically and therefore never go through ChatAppBackend where
    // these fields are normally populated.
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

    // If there are attachments, persist to CAS and build refs BEFORE creating the message
    if (attachments && attachments.length > 0) {
      const store = this.space.getFileStore();
      if (!store) {
        throw new Error("FileStore is required to save attachments");
      }
      const { targetTree, parentFolder } = await this.resolveFileTarget(fileTarget);
      const refs: Array<FileReference> = [];
      for (const att of attachments) {
        if (att?.kind === 'image' && typeof att?.dataUrl === 'string') {
          const put = await store.putDataUrl(att.dataUrl);
          const fileVertex = FilesTreeData.saveFileInfoFromAttachment(
            targetTree,
            att,
            put.hash,
            parentFolder
          );
          refs.push({ tree: targetTree.getId(), vertex: fileVertex.id });
        } else if (att?.kind === 'text' && typeof att?.content === 'string') {
          const textBytes = new TextEncoder().encode(att.content);
          const put = await store.putBytes(textBytes);
          const fileVertex = FilesTreeData.saveFileInfoFromAttachment(
            targetTree,
            att,
            put.hash,
            parentFolder
          );
          refs.push({ tree: targetTree.getId(), vertex: fileVertex.id });
        } else {
          throw new Error(`Unsupported attachment or missing content for kind '${att?.kind}'`);
        }
      }

      properties.files = refs;
    }

    const newMessageVertex = this.appTree.tree.newVertex(lastMsgVertex.id, properties);
    const props = newMessageVertex.getProperties();
    return { id: newMessageVertex.id, ...props } as ThreadMessage;
  }

  /** Resolve target app tree and parent folder for file saves based on optional fileTarget. Defaults to this chat tree under 'files'. */
  private async resolveFileTarget(fileTarget?: { treeId?: string; path?: string; createParents?: boolean }): Promise<{ targetTree: AppTree; parentFolder: Vertex } > {
    // Default: save under the current chat tree at 'files'
    if (!fileTarget || (!fileTarget.treeId && !fileTarget.path)) {
      const targetTree = this.appTree;
      const parentFolder = this.ensureFolderPathInTree(targetTree, ['files'], true);
      return { targetTree, parentFolder };
    }

    // Targeted: load specified tree, ensure path (default to 'files')
    const treeId = fileTarget.treeId ?? this.appTree.getId();
    const targetTree = await this.space.loadAppTree(treeId) as AppTree;
    if (!targetTree) {
      throw new Error(`Target app tree not found: ${treeId}`);
    }
    const rawPath = (fileTarget.path && fileTarget.path.trim() !== '') ? fileTarget.path : 'files';
    const segments = rawPath.split('/').filter(Boolean);
    const parentFolder = this.ensureFolderPathInTree(targetTree, segments, fileTarget.createParents !== false);
    return { targetTree, parentFolder };
  }

  /** Ensure a slash-separated path exists inside the given app tree, creating folders if allowed. Returns the final folder vertex. */
  private ensureFolderPathInTree(appTree: AppTree, segments: string[], createParents: boolean): Vertex {
    const root = appTree.tree.root!;
    let current: Vertex | undefined;
    // If first segment is 'files', ensure a named child for consistency
    if (segments.length > 0 && segments[0] === 'files') {
      current = appTree.tree.getVertexByPath('files') as Vertex | undefined;
      if (!current) {
        if (!createParents) throw new Error(`Path segment 'files' not found and createParents=false`);
        current = root.newNamedChild('files');
        current.setProperty('createdAt', Date.now());
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
      const existing: Vertex | undefined = children.find((c: Vertex) => c.getProperty('_n') === seg);
      if (existing) {
        current = existing;
      } else {
        if (!createParents) throw new Error(`Path segment '${seg}' not found and createParents=false`);
        current = appTree.tree.newVertex(current!.id, { _n: seg, createdAt: Date.now() });
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
      createdAt: Date.now(),
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
    throw new Error("Not implemented");
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
      createdAt: Date.now(),
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
