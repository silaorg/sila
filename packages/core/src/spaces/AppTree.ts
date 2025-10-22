import { RepTree } from "reptree";

type EventCallback = (event: any) => void;

export class AppTree {
  readonly tree: RepTree;
  private eventCallbacks: Map<string, Set<EventCallback>> = new Map();

  static isValid(tree: RepTree): boolean {
    /*
    const root = tree.getVertexByPath('/app-tree');
    if (!root) {
      return false;
    }
    */

    return true;
  }

  static newAppTree(peerId: string, appId: string): AppTree {
    const tree = new RepTree(peerId);
    const root = tree.createRoot();
    root.setProperty('appId', appId);
    return new AppTree(tree);
  }

  constructor(tree: RepTree) {
    this.tree = tree;

    if (!AppTree.isValid(tree)) {
      throw new Error("Invalid tree structure");
    }
  }

  getId(): string {
    return this.tree.root!.id;
  }

  getAppId(): string {
    const appId = this.tree.root!.getProperty('appId');
    if (!appId) {
      throw new Error("App ID is not set");
    }

    return appId as string;
  }

  getVersion(): string {
    const version = this.tree.root!.getProperty('version');
    if (!version) {
      throw new Error("Version is not set");
    }

    return version as string;
  }

  get createdAt(): Date {
    return this.tree.root!.createdAt;
  }

  onEvent(eventName: string, callback: EventCallback): () => void {
    if (!this.eventCallbacks.has(eventName)) {
      this.eventCallbacks.set(eventName, new Set());
    }
    this.eventCallbacks.get(eventName)!.add(callback);
    return () => this.eventCallbacks.get(eventName)?.delete(callback);
  }

  triggerEvent(eventName: string, event: any) {
    const callbacks = this.eventCallbacks.get(eventName);
    if (callbacks) {
      callbacks.forEach(callback => callback(event));
    }
  }
}
