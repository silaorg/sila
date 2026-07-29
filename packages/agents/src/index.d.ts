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
