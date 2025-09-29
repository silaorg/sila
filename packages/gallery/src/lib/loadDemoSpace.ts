import { ClientState } from "@sila/client";
import { buildSpaceFromConfig, type DemoConfig } from "./demo/buildSpaceFromConfig";

const DEFAULT_CONFIG_URL = "/api/demo-space";

export type LoadDemoSpaceOptions = {
  configUrl?: string;
  state?: ClientState;
  initializeState?: boolean;
};

export async function loadDemoSpace(
  options: LoadDemoSpaceOptions = {}
): Promise<{ state: ClientState; spaceId: string; config: DemoConfig }> {
  const configUrl = options.configUrl ?? DEFAULT_CONFIG_URL;
  const state = options.state ?? new ClientState();

  if (options.initializeState !== false) {
    await state.init({});
  }

  const response = await fetch(configUrl);
  if (!response.ok) {
    throw new Error(`Failed to load demo config: ${response.status}`);
  }

  const config = (await response.json()) as DemoConfig;
  const space = await buildSpaceFromConfig(config);

  const spaceId = await state.adoptInMemorySpace(space, config.name);
  return { state, spaceId, config };
}

