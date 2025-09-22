<script lang="ts">
  import { provideClientState } from "./clientStateContext";
  import { ClientState } from "./clientState.svelte";
  import type { Snippet } from "svelte";

  let {
    instance = new ClientState(),
    children,
  }: {
    instance?: ClientState;
    children: Snippet;
  } = $props();

  provideClientState(instance);
</script>

{@render children()}
