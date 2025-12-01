<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    children,
    ariaLabel,
    title,
    disabled = false,
    onclick,
    className = "",
  }: {
    children: Snippet;
    ariaLabel: string;
    title?: string;
    disabled?: boolean;
    onclick?: (e: Event) => void;
    className?: string;
  } = $props();
</script>

<button
  type="button"
  class={`flex items-center justify-center rounded-full w-[22px] h-[22px] text-surface-500 hover:text-surface-700-300 hover:bg-surface-100-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-500 disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
  aria-label={ariaLabel}
  {title}
  {disabled}
  {onclick}
>
  {@render children()}
</button>
