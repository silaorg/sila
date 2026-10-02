import { ModelProvider, ProviderType } from "./models";

export const providers: ModelProvider[] = [
  {
    id: "openrouter",
    name: "OpenRouter",
    access: "cloud",
    url: "https://openrouter.ai/",
    logoUrl: "/providers/openrouter.png",
    defaultModel: "openai/gpt-6.1-sol"
  },
  {
    id: "openai",
    name: "OpenAI",
    access: "cloud",
    url: "https://openai.com/",
    logoUrl: "/providers/openai.png",
    defaultModel: "gpt-6.1-sol"
  },
  {
    id: "anthropic",
    name: "Anthropic",
    access: "cloud",
    url: "https://anthropic.com/",
    logoUrl: "/providers/anthropic.png",
    defaultModel: "claude-sonnet-5-5"
  },
  {
    id: "google",
    name: "Google Gemini",
    access: "cloud",
    url: "https://gemini.google.com/",
    logoUrl: "/providers/google.png",
    defaultModel: "gemini-3.8-flash"
  },
  {
    id: "kimi",
    name: "Kimi",
    access: "cloud",
    url: "https://platform.moonshot.ai/",
    logoUrl: "/providers/kimi.svg",
    defaultModel: "kimi-k2.5"
  },
  {
    id: "xai",
    name: "xAI",
    access: "cloud",
    url: "https://x.ai/",
    logoUrl: "/providers/xai.png",
    defaultModel: "grok-4-1-fast"
  },
  {
    id: "falai",
    name: "Fal.ai",
    access: "cloud",
    url: "https://fal.ai/",
    logoUrl: "/providers/falai.png",
    type: ProviderType.VizGen,
  },
  {
    id: "exa",
    name: "Exa",
    access: "cloud",
    url: "https://exa.ai/",
    logoUrl: "/providers/exa.png",
    type: ProviderType.Search,
  },
];
