<script lang="ts">
  import { type ClientStateConfig, SilaApp } from "@sila/client";
  import { createMobileConfig } from "./lib/mobileConfig";

  let config: ClientStateConfig | null = $state(createMobileConfig());
</script>

<svelte:head>
  <title>Sila</title>
</svelte:head>

<SilaApp {config} />
