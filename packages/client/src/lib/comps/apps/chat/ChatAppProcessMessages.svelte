<script lang="ts">
  import type { Vertex } from "@sila/core";

  let { vertices }: { vertices: Vertex[] } = $props();
</script>

{#each vertices as vertex (vertex.id)}
  <div>{vertex.getProperty("role")}</div>
{/each}
