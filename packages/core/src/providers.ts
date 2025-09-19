import { ModelProvider } from "./models";

export const providers: ModelProvider[] = [
  {
    id: "openrouter",
    name: "OpenRouter",
    access: "cloud",
    url: "https://openrouter.ai/",
    logoUrl: "/providers/openrouter.png",
    defaultModel: "openai/gpt-4o"
  },
  {
    id: "openai",
    name: "OpenAI",
    access: "cloud",
    url: "https://openai.com/",
    logoUrl: "/providers/openai.png",
    defaultModel: "gpt-4o"
  },
  {
    id: "anthropic",
    name: "Anthropic",
    access: "cloud",
    url: "https://anthropic.com/",
    logoUrl: "/providers/anthropic.png",
    defaultModel: "claude-3-5-sonnet-20240620"
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    access: "cloud",
    url: "https://deepseek.com/",
    logoUrl: "/providers/deepseek.png",
    defaultModel: "deepseek-chat"
  },
  {
    id: "google",
    name: "Google Gemini",
    access: "cloud",
    url: "https://gemini.google.com/",
    logoUrl: "/providers/google.png",
    defaultModel: "gemini-2.0-flash"
  },
  {
    id: "groq",
    name: "Groq",
    access: "cloud",
    url: "https://groq.com/",
    logoUrl: "/providers/groq.png",
    defaultModel: "llama-3.3-70b-versatile"
  },
  {
    id: "xai",
    name: "xAI",
    access: "cloud",
    url: "https://x.ai/",
    logoUrl: "/providers/xai.png",
    defaultModel: "grok-2"
  },
  {
    id: "cohere",
    name: "Cohere",
    access: "cloud",
    url: "https://cohere.com/",
    logoUrl: "/providers/cohere.png",
    defaultModel: "command-r-plus"
  },
  {
    id: "mistral",
    name: "Mistral",
    access: "cloud",
    url: "https://mistral.ai/",
    logoUrl: "/providers/mistral.png",
    defaultModel: "mistral-large-latest"
  },
  {
    id: "ollama",
    name: "Ollama",
    access: "local",
    url: "https://ollama.com/",
    logoUrl: "/providers/ollama.png",
  },
];
