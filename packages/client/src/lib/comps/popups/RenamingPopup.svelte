<script lang="ts">
  import { Modal } from "@skeletonlabs/skeleton-svelte";
  import { i18n } from "@sila/client";

  let {
    open = $bindable(),
    existingName,
    onRename,
  }: { open: boolean; existingName?: string; onRename: (newName: string) => void } = $props();
  let newName = $state(existingName ?? "");
  let inputElement: HTMLInputElement;

  $effect(() => {
    if (open && inputElement) {
      inputElement.focus();
    }
  });

  function handleRename() {
    if (newName.trim() !== "") {
      onRename(newName);
      open = false;
    }
  }

  function handleCancel() {
    open = false;
    newName = existingName ?? "";
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" && newName.trim() !== "") {
      handleRename();
    }
  }
</script>

<Modal
  bind:open
  contentBase="card bg-surface-100-900 p-4 space-y-4 shadow-xl max-w-screen-sm"
  backdropClasses="backdrop-blur-sm"
>
  {#snippet content()}
    <div class="space-y-4">
      <label class="label">
        <span class="label-text">{i18n.texts.renamingPopup.newNameLabel}</span>
        <input
          class="input"
          type="text"
          placeholder={i18n.texts.renamingPopup.newNamePlaceholder}
          bind:value={newName}
          bind:this={inputElement}
          onkeydown={handleKeydown}
        />
      </label>

      <div class="flex justify-end gap-2">
        <button class="btn variant-ghost" onclick={handleCancel}>
          {i18n.texts.actions.cancel}
        </button>
        <button
          class="btn preset-filled-surface-500"
          onclick={handleRename}
          disabled={newName.trim() === ""}
        >
          {i18n.texts.actions.done}
        </button>
      </div>
    </div>
  {/snippet}
</Modal>
