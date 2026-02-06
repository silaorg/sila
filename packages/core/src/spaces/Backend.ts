import { Space } from "./Space";
import ChatAppBackend from "../apps/ChatAppBackend";
import { AppTree } from "./AppTree";

/**
 * Monitors all incoming ops and sends them to back-ends specific to app trees.
 * And also checks if there are jobs available to be taken
 */
export class Backend {
  private appBackends: ChatAppBackend[] = [];

  constructor(private space: Space) {
    const loadedTrees = space.getLoadedAppTrees();

    for (const appTree of loadedTrees) {
      this.createAppBackend(appTree);
    }

    space.onTreeLoad((appTreeId) => {
      const appTree = space.getAppTree(appTreeId);
      if (!appTree) {
        throw new Error(`App tree with id ${appTreeId} not found`);
      }

      this.createAppBackend(appTree);
    });
  }

  createAppBackend(appTree: AppTree) {
    const appId = appTree.getAppId();

    if (appId === "default-chat") {
      this.appBackends.push(new ChatAppBackend(this.space, appTree));
    } else if (appId === "files") {
      // Files app trees don't need a backend for now
      console.log(`Files app tree loaded: ${appTree.getId()}`);
    } else {
      console.warn(`There's no backend for app ${appId}`);
    }
  }
}
