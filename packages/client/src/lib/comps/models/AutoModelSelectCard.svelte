<script lang="ts">
  import Sparkles from "lucide-svelte/icons/sparkles";
  import { i18n } from "@sila/client";

  export let selected = false;
  export let onSelect: (providerId: string, model: string) => void;

  function onProviderClick() {
    if (selected) {
      return;
    }

    onSelect("auto", "");
  }
</script>

<div
  class="rounded {selected
    ? 'border border-primary-500'
    : 'border border-surface-500'}"
>
  <button
    class="flex p-2 gap-4 items-center cursor-pointer w-full"
    on:click={onProviderClick}
  >
    <div class="w-8 h-8 flex items-center justify-center rounded">
      <Sparkles size={18} />
    </div>
    <div class="flex flex-col space-y-4">
      <div>
        <span class="font-semibold"> {i18n.texts.models.auto} </span>
        {#if selected}
          <span class="font-semibold"></span>
        {/if}
      </div>
    </div>
  </button>
</div>
