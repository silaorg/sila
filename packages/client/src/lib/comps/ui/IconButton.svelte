<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		children,
		ariaLabel,
		title,
		disabled = false,
		onclick,
		className = ''
	}: {
		children: Snippet;
		ariaLabel: string;
		title?: string;
		disabled?: boolean;
		onclick?: (event: Event) => void;
		className?: string;
	} = $props();
</script>

<button
	type="button"
	class={`flex h-[22px] w-[22px] items-center justify-center rounded-full text-surface-500 hover:bg-surface-100-900 hover:text-surface-700-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-500 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
	aria-label={ariaLabel}
	{title}
	{disabled}
	{onclick}
>
	{@render children()}
</button>
