import { FileReference, JsonValue, ResolvedFileWithData } from "@sila/core";
import { ToolRequest, ToolResult } from "aiwrapper";

export type ThreadMessage = {
  id: string;
  role: string | null;
  text: string | null;
  thinking?: string | null;
  toolRequests?: ToolRequest[] | null;
  toolResults?: ToolResult[] | null;
  inProgress: boolean | null;
  _c: number;
  updatedAt: number | null;
  // Optional metadata
  configId?: string | null;
  configName?: string | null;
  modelProvider?: string | null;
  modelId?: string | null;
  files?: FileReference[] | null;
  meta?: Record<string, JsonValue>;
}

export type ThreadMessageWithResolvedFiles = Omit<ThreadMessage, 'files'> & {
  files?: ResolvedFileWithData[] | null;
}

export interface AppConfig {
  id: string;
  name: string;
  button: string;
  description: string;
  instructions: string;
  targetLLM?: string;
  visible?: boolean;
}

export enum ProviderType {
  AI, 
  Search
}

export type ModelProvider = {
  id: string;
  name: string;
  access: ModelProviderAccessType;
  url: string;
  logoUrl: string;
  defaultModel?: string;
  isCustom?: boolean;
  baseApiUrl?: string; // For custom OpenAI-compatible providers
  type?: ProviderType;
};

export type ModelProviderAccessType = "cloud" | "local";

export type ModelProviderCloudConfig = {
  id: string;
  type: "cloud";
  apiKey: string;
}

export type ModelProviderLocalConfig = {
  id: string;
  type: "local";
  apiUrl: string;
}

export type CustomProviderConfig = ModelProviderCloudConfig & {
  name: string;
  baseApiUrl: string;
  modelId: string; // Required model ID for this provider
  customHeaders?: Record<string, string>;
};

export type ModelProviderConfig = ModelProviderCloudConfig | ModelProviderLocalConfig;