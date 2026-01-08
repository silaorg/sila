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

function enrichDefaultConfig(
  configs: AppConfig[],
  languageProvider?: () => string | undefined,
): AppConfig[] {
  // Enrich the default config with the default values
  const defaultConfigIndex = configs.findIndex((config) => config.id === "default");
  if (defaultConfigIndex !== -1) {
    const defaultConfig = Space.getDefaultAppConfig(
      getTextsForLanguage(languageProvider?.()),
    );
    configs[defaultConfigIndex] = {
      ...defaultConfig,
      ...configs[defaultConfigIndex],
    };
  }

  return configs.sort((a, b) => {
    // @TODO: fix this, make sure we do have _c in our configs
    const aDate = new Date((a as any)._c).getTime();
    const bDate = new Date((b as any)._c).getTime();
    return aDate - bDate;
  });
}

// @TODO: answer: should I resolve 'id' into vertex id? And same for _n to 'name'?

// @TODO: could it be based on a generic data class? SpaceArray<T>(rootVertex: Vertex)
export class AppConfigsData {
  private root: Vertex;
  private languageProvider?: () => string | undefined;

  constructor(root: Vertex, languageProvider?: () => string | undefined) {
    this.root = root;
    this.languageProvider = languageProvider;

    if (!this.root) {
      throw new Error("App configs vertex not found");
    }
  }

  getAll(): AppConfig[] {
    return enrichDefaultConfig(
      this.root.getChildrenAsTypedArray<AppConfig>(),
      this.languageProvider,
    );
  }

  get(configId: string): AppConfig | undefined {
    const config = this.root.findFirstTypedChildWithProperty<AppConfig>("id", configId);

    if (config?.id === "default") {
      return enrichDefaultConfig([config], this.languageProvider)[0];
    }

    return config;
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
    const targetVertex = this.root.findFirstChildVertexWithProperty("id", id);
    if (!targetVertex) {
      throw new Error(`App config ${id} not found`);
    }

    targetVertex.setProperties(updates);
  }

  delete(entry: AppConfig) {
    const vertex = this.root.findFirstChildVertexWithProperty("id", entry.id);
    if (!vertex) {
      throw new Error(`App config ${entry.id} not found`);
    }

    vertex.delete();
  }

  observe(observer: (appConfigs: AppConfig[]) => void) {
    const languageProvider = this.languageProvider;
    const observerWrapper = (appConfigs: AppConfig[]) => {
      observer(enrichDefaultConfig(appConfigs, languageProvider));
    };

    observerWrapper(this.getAll());

    return this.root.observeChildrenAsTypedArray(observerWrapper);
  }
}
