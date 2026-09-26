export type WorkspaceConfig = {
  version: 1;
  name: string;
};

export class WorkspaceConfigError extends Error {}

export const CONFIG_FILE_NAME: "config.json";

export function getConfigPath(workspaceDir: string): string;

export function createDefaultConfig(
  workspaceDir: string,
  overrides?: { name?: string },
): Promise<WorkspaceConfig>;

export function readConfig(workspaceDir: string): Promise<WorkspaceConfig>;

export function createDefaultAgentConfig(
  workspacePath: string,
  overrides?: { provider?: string; model?: string },
): Promise<{ provider: string; model: string }>;

export function createProviderConfig(
  workspacePath: string,
  providerId: string,
  overrides?: { enabled?: boolean; model?: string },
): Promise<{ provider: string; enabled: boolean; model?: string }>;
