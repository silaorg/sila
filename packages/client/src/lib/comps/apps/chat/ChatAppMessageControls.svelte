<script lang="ts">
  import {
    ChevronRight,
    Edit,
    ChevronLeft,
    Copy,
    Check,
  } from "lucide-svelte";
  import { RefreshCw } from "lucide-svelte";

  import { timeout } from "@sila/core";

  let { showEditAndCopyControls, onCopyMessage, onEditMessage, prevBranch, nextBranch, branchIndex, branchesNumber, onRerun }: {
    showEditAndCopyControls: boolean;
    onCopyMessage: () => void;
    onEditMessage: (val?: boolean) => void;
    prevBranch: () => void;
    nextBranch: () => void;
    branchIndex: number;
    branchesNumber: number;
    onRerun?: () => void;
  } = $props();

  let isCopied = $state(false);

  async function copyMessage() {
    onCopyMessage();
    isCopied = true;
    timeout(() => {
      isCopied = false;
    }, 2000);
  }
</script>

<div
  class="flex justify-center gap-2 z-20"
  role="presentation"
>
  {#if showEditAndCopyControls}
  <button
    class="rounded-full p-1 transition"
    title="Copy message"
    onclick={copyMessage}
  >
    {#if isCopied}
      <Check size={14} />
    {:else}
      <Copy size={14} />
    {/if}
  </button>
  <button
    class="p-1 transition"
    title="Edit message"
    onclick={() => onEditMessage(true)}
  >
    <Edit size={14} />
  </button>
  {#if onRerun}
  <button
    class="p-1 transition"
    title="Re-run in new branch"
    onclick={() => onRerun()}
  >
    <RefreshCw size={14} />
  </button>
  {/if}
  {/if}
  {#if branchesNumber > 1}
    <div
      class="flex items-center gap-1 px-2 py-1"
    >
      <button
        onclick={prevBranch}
        disabled={branchIndex === 0}
        class="hover:text-surface-700"
      >
        <ChevronLeft size={14} />
      </button>
      <span class="text-sm"
        >{branchIndex + 1}/{branchesNumber}</span
      >
      <button
        onclick={nextBranch}
        disabled={branchIndex === branchesNumber - 1}
        class="hover:text-surface-700"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  {/if}
</div>
