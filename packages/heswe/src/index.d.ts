export type AppMessage = {
  id: string | null;
  at: string | null;
  role: string;
  text: string;
  attachments: AppFile[];
  activities?: AppActivity[];
};

export type AppActivity = {
  id: string;
  name: string;
  preview: string;
  status: "running" | "complete";
};

export type AppThreadProgress = {
  status: "processing" | "thinking" | "acting";
  text: string;
  activities: AppActivity[];
};

export type AppFile = {
  reference: string;
  scope: "workspace" | "thread";
  path: string;
  name: string;
  size: number;
  mimeType: string;
  kind: "image" | "text" | "file";
};

export type AppWorkspaceEntry =
  | {
    path: string;
    name: string;
    type: "directory";
    size: 0;
  }
  | (AppFile & {
    path: string;
    type: "file";
  });

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
  progress: AppThreadProgress | null;
};

export type AppWorkspaceChange = {
  type: string;
  userId: string;
  workspaceId?: string;
  threadId?: string;
};

export type AppAgentProgress = {
  text: string;
  toolNames: string[];
  tools?: Array<{
    name: string;
    arguments?: Record<string, unknown>;
  }>;
};

export type AppAgentThreadMessageInput = {
  threadId: string;
  threadDir: string;
  userId: string;
  text: string;
  publicText?: string;
  attachments?: Array<Record<string, unknown>>;
  onAssistantLoopMessage?: (payload: {
    text: string;
    toolNames: string[];
  }) => void | Promise<void>;
  onAssistantProgress?: (payload: AppAgentProgress) => void | Promise<void>;
  onAssistantResponding?: () => void | Promise<void>;
};

export type AppAgentThreadMessageResult = {
  responded: boolean;
  answer: string;
};

export type AppAgentRuntime = {
  handleThreadMessage(
    input: AppAgentThreadMessageInput,
  ): Promise<AppAgentThreadMessageResult>;
  stop?(): Promise<void>;
};

export type AppWorkspaceServiceOptions = {
  workspacePath: string;
  threadStore?: unknown;
  createAgentRuntime?: () => AppAgentRuntime | Promise<AppAgentRuntime>;
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
  getModelSettings(): Promise<WorkspaceModelSettings>;
  updateModelSettings(input: unknown): Promise<WorkspaceModelSettings>;
  listThreads(userId: string): Promise<AppThreadSummary[]>;
  createThread(userId: string, input?: { title?: unknown }): Promise<AppThreadSummary>;
  getThread(userId: string, threadId: string): Promise<AppThread>;
  listFiles(userId: string, threadId: string, query?: string): Promise<AppFile[]>;
  uploadFiles(
    userId: string,
    threadId: string,
    files: Array<{ name: string; data: Uint8Array | ArrayBuffer }>,
  ): Promise<AppFile[]>;
  browseWorkspaceFiles(
    userId: string,
    relativeDirectory?: string,
  ): Promise<AppWorkspaceEntry[]>;
  uploadWorkspaceFiles(
    userId: string,
    relativeDirectory: string,
    files: Array<{ name: string; data: Uint8Array | ArrayBuffer }>,
  ): Promise<AppWorkspaceEntry[]>;
  createWorkspaceDirectory(
    userId: string,
    relativeDirectory: string,
    name: unknown,
  ): Promise<AppWorkspaceEntry>;
  renameWorkspaceEntry(
    userId: string,
    relativePath: string,
    name: unknown,
  ): Promise<AppWorkspaceEntry>;
  moveWorkspaceEntries(
    userId: string,
    relativePaths: unknown,
    destinationPath: unknown,
  ): Promise<AppWorkspaceEntry[]>;
  removeWorkspaceEntry(
    userId: string,
    relativePath: string,
  ): Promise<void>;
  getWorkspaceFile(
    userId: string,
    relativePath: string,
  ): Promise<AppFile & { absolutePath: string }>;
  getFile(
    userId: string,
    threadId: string,
    reference: string,
  ): Promise<AppFile & { absolutePath: string; agentPath: string }>;
  removeUploadedFile(
    userId: string,
    threadId: string,
    reference: unknown,
  ): Promise<void>;
  sendMessage(
    userId: string,
    threadId: string,
    input: unknown,
  ): Promise<unknown>;
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

export function getWorkspaceEnvPath(workspacePath: string): string;

export function readWorkspaceEnvironment(
  workspacePath: string,
): Promise<Record<string, string>>;

export function readWorkspaceEnvValue(
  workspacePath: string,
  name: string,
): Promise<string | null>;

export function readEnvValue(name: string): string | null;

export function updateWorkspaceEnvironment(
  workspacePath: string,
  changes: Record<string, string | null>,
): Promise<void>;

export type WorkspaceProviderSetting = {
  id: string;
  name: string;
  kind: "language" | "search" | "viz";
  local: boolean;
  defaultModel: string | null;
  model: string | null;
  enabled: boolean | null;
  apiKeySource: "workspace" | "server" | "none";
};

export type WorkspaceModelSettings = {
  provider: string;
  model: string;
  providers: WorkspaceProviderSetting[];
};

export function readWorkspaceModelSettings(
  workspacePath: string,
): Promise<WorkspaceModelSettings>;

export function updateWorkspaceModelSettings(
  workspacePath: string,
  input: unknown,
): Promise<WorkspaceModelSettings>;

export type RuntimePaths = {
  workspacePath: string;
  threadPath: string | null;
  sourcePath: string | null;
};

export function resolveRuntimePaths(
  input: { workspacePath: string; threadPath?: string },
): Promise<RuntimePaths>;

export function buildRuntimePathsInstructionBlock(
  runtimePaths: RuntimePaths,
): string;

export function buildRuntimePathEnvironment(
  runtimePaths: RuntimePaths,
): Record<string, string>;

export function mergeRuntimePathEnvironment(
  baseEnvironment: Record<string, string | undefined>,
  runtimeEnvironment: Record<string, string>,
): Record<string, string | undefined>;
