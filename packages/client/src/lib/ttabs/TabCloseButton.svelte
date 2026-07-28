<script lang="ts">
	import X from 'lucide-svelte/icons/x';
	import IconButton from '../comps/ui/IconButton.svelte';

	let { onClose }: { onClose: (event: Event) => void } = $props();
</script>

<IconButton
	ariaLabel="Close tab"
	title="Close tab"
	onclick={onClose}
	className="ttabs-tab-close"
>
	{#snippet children()}
		<X size={14} />
	{/snippet}
</IconButton>

<style>
	:global(.ttabs-tab-close) {
		width: var(--ttabs-tab-close-size);
		height: var(--ttabs-tab-close-size);
		border-radius: var(--ttabs-tab-close-border-radius);
	}

	:global(.ttabs-tab-header .ttabs-tab-close) {
		opacity: 0;
	}

	:global(.ttabs-tab-header:hover .ttabs-tab-close),
	:global(.ttabs-tab-header.ttabs-tab-active .ttabs-tab-close:hover) {
		opacity: 1;
	}
</style>
