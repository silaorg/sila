<script lang="ts">
  import { onMount } from "svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { providers } from "@sila/core";
  const clientState = useClientState();
  import type { ModelProviderLocalConfig } from "@sila/core";
  import { checkOllamaStatus } from "./ollama";
  import { interval } from "@sila/core";

  let isChecking = false;

  async function checkAndConfigureOllama() {
    const space = clientState.currentSpace;

    if (isChecking || !space) return;

    isChecking = true;
    try {
      // First check if Ollama is already configured
      const ollamaProvider = providers.find((p) => p.id === "ollama");
      if (!ollamaProvider) return;

      const existingConfig = space.getModelProviderConfig(
        "ollama",
      ) as ModelProviderLocalConfig | undefined;
      if (existingConfig) return;

      // Default to localhost if no config exists
      const address = "http://localhost:11434";

      // Check if Ollama is running
      const isRunning = await checkOllamaStatus();
      if (isRunning) {
        // Ollama is running but not configured, let's add it
        const config: ModelProviderLocalConfig = {
          id: "ollama",
          type: "local",
          apiUrl: address,
        };
        space.saveModelProviderConfig(config);
      }
    } catch (e) {
      // Ollama is not running, we'll check again later
    } finally {
      isChecking = false;
    }
  }

  onMount(() => {
    // Check immediately on mount
    checkAndConfigureOllama();

    // Check every 5 seconds - more frequent for Ollama since it's a local service
    // that users might start/stop more frequently
    return interval(checkAndConfigureOllama, 5000);
  });
</script>
