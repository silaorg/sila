export type ThreadMessage = {
  id: string;
  role: string | null;
  text: string | null;
  thinking?: string | null;
  inProgress: boolean | null;
  createdAt: number;
  updatedAt: number | null;
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

export type ModelProvider = {
  id: string;
  name: string;
  access: ModelProviderAccessType;
  url: string;
  logoUrl: string;
  defaultModel?: string;
  isCustom?: boolean;
  baseApiUrl?: string; // For custom OpenAI-compatible providers
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