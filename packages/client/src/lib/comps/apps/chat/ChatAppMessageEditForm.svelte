<script lang="ts">
  import ChatEditor from "./ChatEditor.svelte";
  import type { FileMention } from "./chatMentionPlugin";

  let {
    initialValue = "",
    onSave,
    onCancel,
    getFileMentions,
  }: {
    initialValue?: string;
    onSave: (text: string) => void;
    onCancel: () => void;
    getFileMentions?: (
      query: string
    ) => Promise<FileMention[]> | FileMention[];
  } = $props();

  let currentText = $state(initialValue);

  $effect(() => {
    currentText = initialValue;
  });

  const isSaveDisabled = $derived(currentText.trim().length === 0);

  function handleSave() {
    if (isSaveDisabled) return;
    onSave(currentText);
  }

  function handleSubmit() {
    handleSave();
  }
</script>

<div class="space-y-2">
  <div class="chat-editor-wrapper relative rounded-md border border-slate-300/60 px-3 py-2 text-[0.9375rem] dark:border-slate-600/80">
    <ChatEditor
      value={currentText}
      autofocus={true}
      onChange={(text) => {
        currentText = text;
      }}
      onSubmit={handleSubmit}
      onEscape={onCancel}
      {getFileMentions}
    />
  </div>

  <div class="flex gap-2 justify-end">
    <button
      type="button"
      class="btn btn-sm preset-outline"
      onclick={onCancel}
    >
      Cancel
    </button>
    <button
      type="button"
      class="btn btn-sm preset-filled"
      onclick={handleSave}
      disabled={isSaveDisabled}
    >
      Save
    </button>
  </div>
</div>

<style>
  .chat-editor-wrapper {
    min-height: 80px;
  }
</style>
