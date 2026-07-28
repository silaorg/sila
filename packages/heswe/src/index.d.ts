export type MessageItem = {
  type: string;
  text?: string;
  [key: string]: unknown;
};

export type AppMessage = {
  id: string;
  at: string;
  role: string;
  items: MessageItem[];
  meta?: unknown;
  text: string;
};

export type AppThreadSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  preview: string;
};

export type AppThread = AppThreadSummary & {
  events: unknown[];
  messages: AppMessage[];
};

export type AppWorkspaceChange = {
  type: string;
  userId: string;
  threadId?: string;
};

export type AppWorkspaceServiceOptions = {
  workspacePath: string;
  threadStore?: unknown;
  createAgentRuntime?: () => unknown | Promise<unknown>;
  onChange?: (change: AppWorkspaceChange) => void | Promise<void>;
};

export class AppWorkspaceService {
  constructor(options: AppWorkspaceServiceOptions);
  getWorkspace(): Promise<{ name: string; path: string }>;
  listThreads(userId: string): Promise<AppThreadSummary[]>;
  createThread(userId: string, input?: { title?: string }): Promise<AppThreadSummary>;
  getThread(userId: string, threadId: string): Promise<AppThread>;
  sendMessage(userId: string, threadId: string, text: string): Promise<unknown>;
  stop(): Promise<void>;
}
