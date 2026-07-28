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
  constructor(
    code: "invalid_input" | "not_found" | "invalid_data",
    message: string,
    options?: ErrorOptions,
  );
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

export type WorkspaceConfig = {
  version: 1;
  name: string;
};

export function createDefaultConfig(
  workspaceDir: string,
  overrides?: { name?: string },
): Promise<WorkspaceConfig>;

export function createDefaultAgentConfig(
  workspacePath: string,
  overrides?: { provider?: string; model?: string },
): Promise<{ provider: string; model: string }>;

export function createProviderConfig(
  workspacePath: string,
  providerId: string,
  overrides?: { enabled?: boolean; model?: string },
): Promise<{ provider: string; enabled: boolean; model?: string }>;
