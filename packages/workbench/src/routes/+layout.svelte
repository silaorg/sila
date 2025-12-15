<script lang="ts">
  // SilaApp has it already but we do it here as well for components rendered
  // outside of the SilaApp
  import "@sila/client/compiled-style.css";

  let { children } = $props();

</script>

{@render children?.()}
