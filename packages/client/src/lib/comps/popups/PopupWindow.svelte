<script lang="ts">
  import { Modal } from "@skeletonlabs/skeleton-svelte";
  import type { Snippet } from "svelte";
  import { i18n } from "@sila/client";

  let {
    children,
    open = true,
    title = "",
    onClose = () => {},
  }: { children: Snippet; open?: boolean; title?: string; onClose?: () => void } = $props();

  let isOpen = $state(open ?? true);

  $effect(() => {
    isOpen = open ?? true;
  });

</script>

<!-- TODO: fix bindable, so it's pssible to re-open the modal -->

<Modal
  open={isOpen}
  contentBase="card bg-surface-100-900 p-4 space-y-4 shadow-xl max-w-screen-sm"
  backdropClasses="backdrop-blur-sm"
>
  {#snippet content()}
    {#if title}
      <div class="flex items-center justify-between">
        <h3 class="text-base font-semibold">{title}</h3>
        <button
          class="opacity-70 hover:opacity-100"
          onclick={() => { isOpen = false; onClose?.(); }}
          aria-label={i18n.texts.actions.close}
        >
          ✕
        </button>
      </div>
    {/if}
    {@render children()}
  {/snippet}
</Modal>
