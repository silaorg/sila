<script lang="ts">
  // SilaApp has it already but we do it here as well for components rendered
  // outside of the SilaApp
  import "@sila/client/compiled-style.css";
  import { browser } from "$app/environment";
  import { onMount } from "svelte";

  let { children } = $props();

  onMount(() => {
    if (browser) {
      document.documentElement.setAttribute("data-theme", "cerberus");
    }
  });

</script>

{@render children?.()}
