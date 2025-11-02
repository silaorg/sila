import { RepTree } from "reptree";
import { AppTree } from "./AppTree";
import type { AppConfig, CustomProviderConfig } from "../models";
import type { VertexOperation, VertexPropertyType } from "reptree";
import type { ModelProviderConfig } from "../models";
import { validateKey } from "../tools/providerKeyValidators";
import { Vertex } from "reptree";
import { AppConfigsData } from "./AppConfigsData";
import uuid from "../utils/uuid";
import type { FileStore } from "./files";
import { createFileStore } from "./files";
import type { FileStoreProvider } from "./files/FileStore";

export class Space {
  readonly tree: RepTree;
  private secrets: Record<string, string> | undefined;
  private appTrees: Map<string, AppTree> = new Map();
  private newTreeObservers: ((treeId: string) => void)[] = [];
  private treeLoadObservers: ((treeId: string) => void)[] = [];
  private treeLoader: ((treeId: string) => Promise<AppTree | undefined>) | undefined;
  readonly appTreesVertex: Vertex;

  private fileStoreProvider: FileStoreProvider | null = null;

  readonly appConfigs: AppConfigsData;

  static isValid(tree: RepTree): boolean {
    const apps = tree.getVertexByPath('app-configs');
    if (!apps) {
      return false;
    }

    const chats = tree.getVertexByPath('app-instances');
    if (!chats) {
      return false;
    }

    return true;
  }

  static newSpace(peerId: string): Space {
    const tree = new RepTree(peerId);

    /*
    // @TODO: perhaps define the stucture like this:
    ```js
    {
      version: '0',
      onboarding: true,
      $children: {
        app-configs,
        app-instances,
        providers,
        settings,
        files
      }
    }
    ```
    */

    const root = tree.createRoot();
    root.setProperties({
      'version': '0',
      'onboarding': true
    });
    const appConfigs = root.newNamedChild('app-configs');
    appConfigs.newChild(Space.getDefaultAppConfig());
    root.newNamedChild('app-instances');
    root.newNamedChild('providers');
    root.newNamedChild('settings');
    root.newNamedChild('files');

    return new Space(tree);
  }

  static existingSpaceFromOps(ops: ReadonlyArray<VertexOperation>): Space {
    const tree = new RepTree(uuid(), ops);
    return new Space(tree);
  }

  constructor(tree: RepTree) {
    this.tree = tree;

    // @TODO: or perhaps a migration should be here
    if (!Space.isValid(tree)) {
      throw new Error("Invalid tree structure");
    }

    this.appTreesVertex = tree.getVertexByPath('app-instances') as Vertex;
    this.appConfigs = new AppConfigsData(this.tree.getVertexByPath('app-configs')!);
  }

  /** Space id is the same as the root vertex id of the space tree */
  getId(): string {
    return this.tree.root!.id;
  }

  setFileStoreProvider(provider: FileStoreProvider) {
    this.fileStoreProvider = provider;
  }

  getFileStore(): FileStore | null {
    return createFileStore(this.fileStoreProvider);
  }

  get rootVertex(): Vertex {
    const rootVertex = this.tree.root;
    if (!rootVertex) {
      throw new Error("Root vertex not found");
    }

    return rootVertex;
  }

  get name(): string | undefined {
    return this.rootVertex.name;
  }

  set name(name: string) {
    this.rootVertex.name = name;
  }

  get createdAt(): Date {
    return this.rootVertex.createdAt;
  }

  get hasSetupProviders(): boolean {
    const providersVertex = this.tree.getVertexByPath('providers');
    return providersVertex ? providersVertex.children.length > 0 : false;
  }

  /**
   * Create a new app tree and reference it in an outside vertex
   * @param appId - The id of the app
   * @param targetRefVertex - The vertex to reference the app tree (in 'tid' property)
   * @returns The app tree
   */
  newAppTree(appId: string, targetRefVertex?: Vertex): AppTree {
    const appTree = AppTree.newAppTree(this.tree.peerId, appId);

    if (targetRefVertex) {
      targetRefVertex.setProperty('tid', appTree.getId());
    }
    // If no target vertex is provided, create a new vertex in 'app-instances' of the space and reference the app tree in it
    else {
      const appsTrees = this.tree.getVertexByPath('app-instances');

      if (!appsTrees) {
        throw new Error("Apps trees vertex not found");
      }

      this.tree.newVertex(appsTrees.id, { tid: appTree.getId() });
    }

    this.appTrees.set(appTree.getId(), appTree);

    for (const listener of this.newTreeObservers) {
      listener(appTree.getId());
    }

    for (const listener of this.treeLoadObservers) {
      listener(appTree.getId());
    }

    return appTree;
  }

  setAppTreeName(appTreeId: string, name: string) {
    const vertex = this.getVertexReferencingAppTree(appTreeId);
    if (!vertex || vertex.name === name) return;

    vertex.name = name;
  }

  getVertex(vertexId: string): Vertex | undefined {
    return this.tree.getVertex(vertexId);
  }

  getVertexByPath(path: string): Vertex | undefined {
    return this.tree.getVertexByPath(path);
  }

  // @TODO: make part of Vertex
  findObjectWithPropertyAtPath(path: string, key: string, value: VertexPropertyType): object | undefined {
    const arr = this.getArray<object>(path);
    // Check if the object has the property and its value matches the given value
    return arr.find((obj: object) => {
      const typedObj = obj as Record<string, VertexPropertyType>;
      return typedObj[key] === value;
    });
  }

  /**
   * Load an app tree (a wrapped instance of RepTree) if it's not already loaded
   * @param appTreeId - The id of the app tree to load
   * @returns The app tree if it's loaded, undefined otherwise
   */
  async loadAppTree(appTreeId: string): Promise<AppTree | undefined> {
    let appTree = this.appTrees.get(appTreeId);
    if (appTree) {
      return appTree;
    }

    if (!this.treeLoader) {
      throw new Error("No tree loader registered");
    }

    appTree = await this.treeLoader(appTreeId);
    if (appTree) {
      this.appTrees.set(appTreeId, appTree);

      for (const listener of this.treeLoadObservers) {
        listener(appTree.getId());
      }
    }

    return appTree;
  }

  observeNewAppTree(observer: (appTreeId: string) => void) {
    this.newTreeObservers.push(observer);
  }

  unobserveNewAppTree(observer: (appTreeId: string) => void) {
    this.newTreeObservers = this.newTreeObservers.filter(l => l !== observer);
  }

  observeTreeLoad(observer: (appTreeId: string) => void) {
    this.treeLoadObservers.push(observer);
  }

  unobserveTreeLoad(observer: (appTreeId: string) => void) {
    this.treeLoadObservers = this.treeLoadObservers.filter(l => l !== observer);
  }

  registerTreeLoader(loader: (appTreeId: string) => Promise<AppTree | undefined>) {
    this.treeLoader = loader;
  }

  getAppTree(appTreeId: string): AppTree | undefined {
    return this.appTrees.get(appTreeId);
  }

  getLoadedAppTrees(): ReadonlyArray<AppTree> {
    return Array.from(this.appTrees.values());
  }

  getAppTreeIds(): ReadonlyArray<string> {
    return this.appTreesVertex.children.map(v => v.id);
  }

  deleteAppTree(appTreeId: string) {
    const vertex = this.getVertexReferencingAppTree(appTreeId);
    if (!vertex) return;

    this.tree.deleteVertex(vertex.id);
  }

  getVertexReferencingAppTree(appTreeId: string): Vertex | undefined {
    for (const vertex of this.appTreesVertex.children) {
      if (vertex.getProperty('tid') === appTreeId) {
        return vertex;
      }
    }

    return undefined;
  }

  createVertex() {

  }

  setProps() {

  }

  getArray<T>(path: string): T[] {
    const vertex = this.tree.getVertexByPath(path);

    if (!vertex) return [];

    return this.vertexChildrenToTypedArray<T>(vertex);
  }

  private vertexChildrenToTypedArray<T>(vertex: Vertex): T[] {
    return vertex.children.map(child => {
      if (!child) return null;

      const properties = child.getProperties();
      return properties as unknown as T;
    }).filter((item): item is T => item !== null);
  }

  getAppConfigs(): AppConfig[] {
    return this.getArray<AppConfig>('app-configs');
  }

  getAppConfig(configId: string): AppConfig | undefined {
    const config = this.findObjectWithPropertyAtPath('app-configs', 'id', configId);

    if (configId === "default") {
      const defaultConfig = Space.getDefaultAppConfig();

      return {
        ...config,
        ...defaultConfig
      } as AppConfig;
    }

    if (!config) return undefined;

    return config as AppConfig;
  }

  static getDefaultAppConfig(): AppConfig {
    return {
      id: "default",
      name: "Chat",
      button: "New query",
      visible: true,
      description: "A basic chat assistant",
      instructions:
        "You are Sila, an AI assistant. Be direct in all responses. Use simple language. Avoid niceties, filler words, and formality.",
    } as AppConfig;
  }

  // Get provider config and add API key from secrets if it's a cloud provider
  getModelProviderConfig(providerId: string): ModelProviderConfig | undefined {
    const config = this.getFirstObjectWithPropertyAtPath('providers', 'id', providerId) as ModelProviderConfig | undefined;
    if (!config) return undefined;

    if (config.type === 'cloud') {
      const apiKey = this.getServiceApiKey(providerId);
      if (apiKey) {
        config.apiKey = apiKey;
      }
    }

    return config;
  }

  getModelProviderConfigs(): ModelProviderConfig[] {
    const configs = this.getArray('providers') as ModelProviderConfig[];
    return configs.map(config => {
      if (config.type === 'cloud') {
        const apiKey = this.getServiceApiKey(config.id);
        if (apiKey) {
          return { ...config, apiKey };
        }
      }
      return config;
    });
  }

  deleteModelProviderConfig(providerId: string) {
    const providerVertex = this.getFirstVertexWithPropertyAtPath('providers', 'id', providerId);
    if (!providerVertex) return;

    this.tree.deleteVertex(providerVertex.id);
  }

  async getModelProviderStatus(targetLLMOrProvider: string): Promise<"valid" | "invalid" | "not-setup"> {
    const providerId = targetLLMOrProvider.split("/")[0];
    const config = this.getModelProviderConfig(providerId);

    if (!config) return "not-setup";

    if (config?.type === "cloud") {
      const apiKey = this.getServiceApiKey(providerId);
      if (!apiKey) return "not-setup";

      return await validateKey(providerId, apiKey) ? "valid" : "invalid";
    }

    return "valid";
  }

  insertIntoArray(path: string, item: object): Vertex {
    const vertex = this.tree.getVertexByPath(path);
    if (!vertex) {
      throw new Error(`Path ${path} not found`);
    }

    const newVertex = this.tree.newVertex(vertex.id);

    // Set all properties from the item
    for (const [key, value] of Object.entries(item)) {
      this.tree.setVertexProperty(newVertex.id, key, value as VertexPropertyType);
    }

    return newVertex;
  }

  private getFirstVertexWithPropertyAtPath(path: string, key: string, value: VertexPropertyType): Vertex | undefined {
    const vertex = this.tree.getVertexByPath(path);
    if (!vertex) return undefined;

    for (const child of vertex.children) {
      const property = child.getProperty(key);
      if (property === value) {
        return child;
      }
    }

    return undefined;
  }

  getFirstObjectWithPropertyAtPath(path: string, key: string, value: VertexPropertyType): object | undefined {
    const vertex = this.getFirstVertexWithPropertyAtPath(path, key, value);
    if (!vertex) return undefined;

    return vertex.getProperties();
  }

  updateInArray(vertexId: string, updates: Partial<object>): void {
    const vertex = this.tree.getVertex(vertexId);
    if (!vertex) {
      throw new Error(`Vertex ${vertexId} not found`);
    }

    // Update only the provided properties
    for (const [key, value] of Object.entries(updates)) {
      this.tree.setVertexProperty(vertex.id, key, value as VertexPropertyType);
    }
  }

  deleteVertex(vertexId: string): void {
    const vertex = this.tree.getVertex(vertexId);
    if (!vertex) {
      throw new Error(`Vertex ${vertexId} not found`);
    }

    this.tree.deleteVertex(vertexId);
  }

  // Example usage methods:
  addAppConfig(config: AppConfig): Vertex {
    return this.insertIntoArray('app-configs', config);
  }

  updateAppConfig(configId: string, updates: Partial<AppConfig>): void {
    const vertexId = this.getFirstVertexWithPropertyAtPath('app-configs', 'id', configId);
    if (!vertexId) {
      throw new Error(`App config ${configId} not found`);
    }

    this.updateInArray(vertexId.id, updates);
  }

  deleteAppConfig(vertexId: string): void {
    this.deleteVertex(vertexId);
  }

  // For cloud providers, store API key in secrets and remove from config
  saveModelProviderConfig(config: ModelProviderConfig) {
    if (config.type === 'cloud' && 'apiKey' in config) {
      const { apiKey, ...configWithoutKey } = config;
      this.setApiKey(config.id, apiKey);
      this.insertIntoArray('providers', configWithoutKey);
    } else {
      this.insertIntoArray('providers', config);
    }
  }

  getAllSecrets(): Record<string, string> | undefined {
    return this.secrets;
  }

  saveAllSecrets(secrets: Record<string, string>) {
    this.secrets = secrets;
  }

  getSecret(key: string): string | undefined {
    return this.secrets?.[key];
  }

  getServiceApiKey(provider: string): string | undefined {
    return this.secrets?.[`api-key-${provider}`];
  }

  setSecret(key: string, value: string) {
    if (!this.secrets) {
      this.secrets = {};
    }

    this.secrets[key] = value;
  }

  setApiKey(providerId: string, apiKey: string) {
    this.setSecret(`api-key-${providerId}`, apiKey);
  }

  // Custom OpenAI-like providers methods

  /**
   * Add a new custom OpenAI-like provider
   * @param config Provider configuration
   * @returns The generated provider ID
   */
  addCustomProvider(config: Omit<CustomProviderConfig, 'id' | 'type'>): string {
    // Generate a unique ID with a custom prefix
    const id = `custom-${uuid()}`;

    // Create the full config
    const fullConfig: CustomProviderConfig = {
      ...config,
      id,
      type: 'cloud'
    };

    // Save the config
    this.saveModelProviderConfig(fullConfig);

    return id;
  }

  /**
   * Update an existing custom provider
   * @param id Provider ID
   * @param updates Partial updates to apply
   */
  updateCustomProvider(id: string, updates: Partial<Omit<CustomProviderConfig, 'id' | 'type'>>): void {
    const config = this.getModelProviderConfig(id) as CustomProviderConfig | undefined;
    if (!config) {
      throw new Error(`Custom provider with ID ${id} not found`);
    }

    // Create updated config
    const updatedConfig: CustomProviderConfig = {
      ...config,
      ...updates,
      id,
      type: 'cloud'
    };

    // Delete the old config
    this.deleteModelProviderConfig(id);

    // Save the updated config
    this.saveModelProviderConfig(updatedConfig);
  }

  /**
   * Remove a custom provider
   * @param id Provider ID
   */
  removeCustomProvider(id: string): void {
    this.deleteModelProviderConfig(id);
  }

  /**
   * Get all custom providers
   * @returns Array of custom provider configurations
   */
  getCustomProviders(): CustomProviderConfig[] {
    return this.getModelProviderConfigs()
      .filter(config =>
        // Identify custom providers by ID prefix
        config.id.startsWith('custom-') &&
        // Ensure it has the required properties of a custom provider
        'baseApiUrl' in config &&
        'modelId' in config
      ) as CustomProviderConfig[];
  }
}
