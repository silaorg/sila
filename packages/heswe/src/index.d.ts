export type AppMessage = {
  id: string | null;
  at: string | null;
  role: string;
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

export class AppWorkspaceError extends Error {
  code: "invalid_input" | "not_found" | "invalid_data";
}

export class AppWorkspaceService {
  constructor(options: AppWorkspaceServiceOptions);
  getWorkspace(): Promise<{ name: string }>;
  listThreads(userId: string): Promise<AppThreadSummary[]>;
  createThread(userId: string, input?: { title?: unknown }): Promise<AppThreadSummary>;
  getThread(userId: string, threadId: string): Promise<AppThread>;
  sendMessage(userId: string, threadId: string, text: unknown): Promise<unknown>;
  stop(): Promise<void>;
}
