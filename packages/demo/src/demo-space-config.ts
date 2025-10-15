export interface DemoSpaceConfig {
  type: "sila-space";
  version: "1";
  name: string;
  createdAt: string;
  description?: string;
  assistants: AssistantConfig[];
  providers: ProviderConfig[];
  conversations: ConversationConfig[];
}

export interface AssistantConfig {
  id: string;
  name: string;
  button: string;
  visible?: boolean;
  description: string;
  instructions: string;
  targetLLM?: string;
}

export interface ProviderConfig {
  id: string;
  apiKey?: string;
}

export interface ConversationConfig {
  title: string;
  assistant: string;
  messages: MessageNode;
}

export interface MessageNode {
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  main?: boolean;
  children?: MessageNode[];
}