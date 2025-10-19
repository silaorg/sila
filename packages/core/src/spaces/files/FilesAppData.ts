import type { Vertex } from "reptree";
import type { Space } from "../Space";
import { AppTree } from "../AppTree";

export class FilesAppData {
  private root: Vertex;

  static createNewFilesTree(space: Space): AppTree {
    const appTree = space.newAppTree("files");
    const root = appTree.tree.root;

    if (!root) {
      throw new Error("Root vertex not found");
    }

    root.setProperty("name", "Files");
    root.newNamedChild("files");

    return appTree;
  }

  static async getOrCreateDefaultFilesTree(space: Space): Promise<AppTree> {
    // First, try to find an existing files tree by checking all loaded app trees
    const appTrees = (space as any).appTrees;
    for (const [treeId, appTree] of appTrees) {
      if (appTree && appTree.getAppId() === "files") {
        return appTree;
      }
    }

    // Try to load any existing files tree from persistence
    try {
      const appTreeIds = space.getAppTreeIds();
      for (const treeId of appTreeIds) {
        const appTree = await space.loadAppTree(treeId);
        if (appTree && appTree.getAppId() === "files") {
          return appTree;
        }
      }
    } catch (error) {
      console.warn("Failed to load existing files tree:", error);
    }

    // If no files tree exists, create one using createNewFilesTree to ensure proper structure
    return FilesAppData.createNewFilesTree(space);
  }

  constructor(private space: Space, private appTree: AppTree) {
    const root = appTree.tree.root;

    if (!root) {
      throw new Error("Root vertex not found");
    }

    this.root = root;
  }

  get filesVertex(): Vertex | undefined {
    return this.appTree.tree.getVertexByPath("files");
  }

  get fileVertices(): Vertex[] {
    const filesRoot = this.filesVertex;
    if (!filesRoot) return [];

    const files: Vertex[] = [];
    const collectFiles = (vertex: Vertex) => {
      if (vertex.name === "file") {
        files.push(vertex);
      }
      for (const child of vertex.children) {
        collectFiles(child);
      }
    };

    collectFiles(filesRoot);
    return files;
  }

  get threadId(): string {
    return this.root.id;
  }
}
