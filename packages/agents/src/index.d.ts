import type {
  AppAgentProgress,
  AppAgentRuntime,
  AppAgentThreadMessageInput,
  AppAgentThreadMessageResult,
} from "heswe/app-workspace-service";

export type AgentProgress = AppAgentProgress;

export type AgentThreadMessageInput = AppAgentThreadMessageInput;

export type {
  AppAgentProgress,
  AppAgentRuntime,
  AppAgentThreadMessageInput,
  AppAgentThreadMessageResult,
};

export type ProcessAgentRuntimeOptions = {
  workspacePath: string;
  workerPath?: string;
  workerWorkspacePath?: string;
  environment?: Record<string, string | undefined>;
};

export class ProcessAgentRuntime implements AppAgentRuntime {
  constructor(options: ProcessAgentRuntimeOptions);
  handleThreadMessage(
    input: AgentThreadMessageInput,
  ): Promise<AppAgentThreadMessageResult>;
  stop(): Promise<void>;
}

export function createAgentWorkerEnvironment(
  source?: Record<string, string | undefined>,
): Record<string, string>;

export type RunscConfiguration = {
  dockerCommand: string;
  image: string;
  network: string;
  userId: string;
  groupId: string;
  cpus: string;
  memory: string;
  pidsLimit: string;
};

export type RunscAgentRuntimeOptions = Pick<RunscConfiguration, "image" | "network">
  & Partial<Omit<RunscConfiguration, "image" | "network">>
  & {
    workspaceId: string;
    workspacePath: string;
    workspaceRoot: string;
    environment?: Record<string, string | undefined>;
  };

export class RunscAgentRuntime implements AppAgentRuntime {
  constructor(options: RunscAgentRuntimeOptions);
  handleThreadMessage(
    input: AgentThreadMessageInput,
  ): Promise<AppAgentThreadMessageResult>;
  stop(): Promise<void>;
}

export function assertRunscAvailable(
  options: Pick<RunscConfiguration, "image" | "network">
    & Partial<Omit<RunscConfiguration, "image" | "network">>,
): Promise<void>;

export function readRunscConfiguration(
  environment?: Record<string, string | undefined>,
): RunscConfiguration;
