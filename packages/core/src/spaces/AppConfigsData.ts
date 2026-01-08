import type { AppConfig } from "../models";
import type { Vertex } from "reptree";
import { Space } from "./Space";
import { createTexts, SUPPORTED_LANGUAGES, type SupportedLanguage } from "../localization/getTexts";
import type { Texts } from "../localization/texts";

function getTextsForLanguage(language?: string): Texts {
  if (language && SUPPORTED_LANGUAGES.includes(language as SupportedLanguage)) {
    return createTexts(language as SupportedLanguage);
  }
  return createTexts("en");
}

function sortByCreatedAt(configs: AppConfig[]): AppConfig[] {
  return configs.sort((a, b) => {
    // @TODO: fix this, make sure we do have _c in our configs
    const aC = (a as any)?._c;
    const bC = (b as any)?._c;
    const aDate = typeof aC === "number" ? aC : new Date(aC ?? 0).getTime();
    const bDate = typeof bC === "number" ? bC : new Date(bC ?? 0).getTime();
    return aDate - bDate;
  });
}

// @TODO: could it be based on a generic data class? SpaceArray<T>(rootVertex: Vertex)
export class AppConfigsData {
  private root: Vertex;
  private getWorkspaceLanguage?: () => string | undefined;

  constructor(root: Vertex, getWorkspaceLanguage?: () => string | undefined) {
    this.root = root;
    this.getWorkspaceLanguage = getWorkspaceLanguage;

    if (!this.root) {
      throw new Error("App configs vertex not found");
    }
  }

  getAll(): AppConfig[] {
    const configs = this.root.getChildrenAsTypedArray<AppConfig>();

    // Default assistant is always virtual (computed from texts).
    // If it exists in the tree, we only treat it as an overrides container.
    const storedDefault = configs.find((c) => c.id === "default");
    const others = configs.filter((c) => c.id !== "default");

    const defaultConfig: AppConfig = {
      ...Space.getDefaultAppConfig(
        getTextsForLanguage(this.getWorkspaceLanguage?.()),
      ),
      // Only allow persisted overrides for default assistant (for now).
      targetLLM: storedDefault?.targetLLM,
      visible: storedDefault?.visible ?? true,
    };
    // Keep default first in UI lists
    (defaultConfig as any)._c = (storedDefault as any)?._c ?? 0;

    return [defaultConfig, ...sortByCreatedAt(others)];
  }

  get(configId: string): AppConfig | undefined {
    if (configId === "default") {
      const storedDefault = this.root.findFirstTypedChildWithProperty<AppConfig>(
        "id",
        "default",
      );

      return {
        ...Space.getDefaultAppConfig(
          getTextsForLanguage(this.getWorkspaceLanguage?.()),
        ),
        targetLLM: storedDefault?.targetLLM,
        visible: storedDefault?.visible ?? true,
      };
    }

    return this.root.findFirstTypedChildWithProperty<AppConfig>("id", configId);
  }

  // @TODO: consider adding automatically
  add(config: AppConfig) {
    // @TODO: Require ID

    this.root.newChild({
      id: config.id,
      name: config.name,
      description: config.description,
      instructions: config.instructions,
      targetLLM: config.targetLLM,
    });
  }

  update(id: string, updates: Partial<AppConfig>) {
    if (id === "default") {
      throw new Error("Default app config is virtual; update it via Space.updateAppConfig");
    }
    const targetVertex = this.root.findFirstChildVertexWithProperty("id", id);
    if (!targetVertex) {
      throw new Error(`App config ${id} not found`);
    }

    targetVertex.setProperties(updates);
  }

  delete(entry: AppConfig) {
    if (entry.id === "default") {
      throw new Error("Default app config cannot be deleted");
    }
    const vertex = this.root.findFirstChildVertexWithProperty("id", entry.id);
    if (!vertex) {
      throw new Error(`App config ${entry.id} not found`);
    }

    vertex.delete();
  }

  observe(observer: (appConfigs: AppConfig[]) => void) {
    const observerWrapper = (appConfigs: AppConfig[]) => {
      observer(this.getAll());
    };

    observerWrapper(this.getAll());

    return this.root.observeChildrenAsTypedArray(observerWrapper);
  }
}
