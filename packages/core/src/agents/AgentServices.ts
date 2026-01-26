import { Lang, LanguageProvider } from 'aiwrapper';
import { Space } from '../spaces/Space';
import { splitModelString } from '../utils/modelUtils';
import { resolveAutoModelIdForProvider, resolveMostCapableLanguageModel } from '../utils/autoModel';
import { LangTool } from 'aiwrapper/dist/lang/messages';
import type { AppTree } from "../spaces/AppTree";
import { toolRead } from "./tools/toolRead";
import { toolLs } from "./tools/toolLs";
import { toolMkdir } from "./tools/toolMkdir";
import { toolRm } from "./tools/toolRm";
import { toolMove } from "./tools/toolMove";
import { toolApplyPatch } from "./tools/toolApplyPatch";
import { toolSearchReplacePatch } from "./tools/toolSearchReplacePatch";
import { toolGenerateImage } from "./tools/toolGenerateImage";
import { toolGenerateVideo } from "./tools/toolGenerateVideo";
import { toolLook } from "./tools/toolLook";
import { toolWebSearch } from "./tools/toolWebSearch";
import { toolSpreadsheet } from "./tools/toolSpreadsheet";
import type { AgentTool } from "./tools/AgentTool";

export class AgentServices {
  readonly space: Space;
  private lastResolvedProvider: string | null = null;
  private lastResolvedModel: string | null = null;

  constructor(space: Space) {
    this.space = space;
  }

  async lang(model?: string): Promise<LanguageProvider> {
    let modelProvider: string;
    let modelName: string;

    // When a model is specified, split it into provider and model name
    // e.g model = openai/o3 or ollama/auto or custom-uuid/openai/gpt-4
    if (model && !model.startsWith("auto")) {
      const modelParts = splitModelString(model);
      if (!modelParts) {
        throw new Error("Invalid model name");
      }

      modelProvider = modelParts.providerId;
      modelName = modelParts.modelId;

      // If the provider is set but the model is "auto", find a model within the provider
      // e.g model = ollama/auto
      if (modelName.endsWith("auto")) {
        modelName = await this.resolveAutoModel(modelProvider);
      }
    }
    // When no provider is specified, find the most capable model from a provider
    // model = "auto" or undefined
    else {
      const mostCapableModel = await this.getMostCapableModel();

      if (mostCapableModel === null) {
        throw new Error("No capable model found");
      }

      modelProvider = mostCapableModel.provider;
      modelName = mostCapableModel.model;
    }

    this.lastResolvedProvider = modelProvider;
    this.lastResolvedModel = modelName;
    return this.createLanguageProvider(modelProvider, modelName);
  }

  getLastResolvedModel(): { provider: string; model: string } | null {
    if (this.lastResolvedProvider && this.lastResolvedModel) {
      return { provider: this.lastResolvedProvider, model: this.lastResolvedModel };
    }
    return null;
  }

  async getKey(provider: string): Promise<string> {
    const providerConfig = this.space.getModelProviderConfig(provider);

    if (!providerConfig) {
      throw new Error("No provider config found");
    }

    // First check if config itself contains 'apiKey'
    if ("apiKey" in providerConfig) {
      return providerConfig.apiKey as string;
    }

    // @NOTE: consider adding checks in other parts, such as user profile

    throw new Error("No API key found");
  }

  async getMostCapableModel(): Promise<
    { provider: string; model: string } | null
  > {
    return await resolveMostCapableLanguageModel(this.space.getModelProviderConfigs());
  }

  getToolsForModel(
    model: { provider: string; model: string } | null,
    opts?: { appTree?: AppTree }
  ): { toolDefs: AgentTool[], tools: LangTool[] } {
    const tools: LangTool[] = [];
    const appTree = opts?.appTree;
    if (!appTree) {
      throw new Error("appTree is required to build agent tools");
    }
    let useApplyPatch = false;

    if (model && model.provider === "openai" && model.model.includes("gpt-5.1")) {
      useApplyPatch = true;
    }

    const toolDefs: AgentTool[] = [
      toolWebSearch,
      toolRead,
      toolLook,
      toolLs,
      toolMkdir,
      toolRm,
      toolMove,
      useApplyPatch ? toolApplyPatch : toolSearchReplacePatch,
      toolGenerateImage,
      toolGenerateVideo,
      toolSpreadsheet,
    ];

    const enabledTools = toolDefs.filter((tool) =>
      tool.canUseTool ? tool.canUseTool(this, appTree) : true
    );

    for (const tool of enabledTools) {
      tools.push(tool.getTool(this, appTree));
    }

    return {
      toolDefs: enabledTools,
      tools
    }
  }

  async createLanguageProvider(provider: string, model: string): Promise<LanguageProvider> {
    // Common configuration for API-based providers
    const options: Record<string, any> = { model };

    // Add API key for providers that require it (all except ollama)
    if (provider !== "ollama") {
      options.apiKey = await this.getKey(provider);
    }

    // Handle custom OpenAI-like providers
    if (provider.startsWith('custom-')) {
      const config = this.space.getModelProviderConfig(provider);
      if (!config || !('baseApiUrl' in config)) {
        throw new Error(`Invalid custom provider configuration for: ${provider}`);
      }

      // Create a custom OpenAI-like provider
      return Lang.openaiLike({
        apiKey: options.apiKey,
        model: model,
        baseURL: config.baseApiUrl as string,
        headers: ('customHeaders' in config) ? config.customHeaders as Record<string, string> : undefined
      });
    }

    // Check if the provider method exists on Lang
    if (typeof Lang[provider as keyof typeof Lang] === 'function') {
      // Dynamically call the provider method with the options
      return Lang[provider as keyof typeof Lang](options);
    }

    throw new Error(`Invalid model provider: ${provider}`);
  }

  /**
   * Resolve "provider/auto" to a concrete model id for that provider.
   *
   * Delegates to a shared util so UI + agent behavior stays consistent.
   */
  private async resolveAutoModel(provider: string): Promise<string> {
    return await resolveAutoModelIdForProvider(provider);
  }
}
