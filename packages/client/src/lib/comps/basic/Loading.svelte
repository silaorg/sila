<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { globalLoading } from "../../state/loading.svelte";

  onMount(() => {
    globalLoading.show();
  });

  onDestroy(() => {
    globalLoading.hide();
  });
</script>
