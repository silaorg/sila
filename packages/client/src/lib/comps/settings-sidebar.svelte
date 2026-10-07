<script lang="ts">
	import Cpu from 'lucide-svelte/icons/cpu';
	import Settings from 'lucide-svelte/icons/settings';
	import ChevronRight from 'lucide-svelte/icons/chevron-right';

	let {
		active,
		onSelect
	}: {
		active: 'preferences' | 'providers';
		onSelect: (page: 'preferences' | 'providers') => void;
	} = $props();
	let navigation: HTMLElement | undefined = $state();

	export function focusActive() {
		navigation?.querySelector<HTMLButtonElement>('[aria-current="page"]')?.focus();
	}

</script>

<nav class="settings-sidebar" aria-label="Settings categories" bind:this={navigation}>
	<div class="settings-section-label">
		Workspace
	</div>

	<button
		type="button"
		class="settings-category"
		aria-current={active === 'preferences' ? 'page' : undefined}
		onclick={() => onSelect('preferences')}
	>
		<Settings size={18} />
		<span>Preferences</span>
		<ChevronRight size={18} class="settings-category-chevron" />
	</button>

	<button
		type="button"
		class="settings-category"
		aria-current={active === 'providers' ? 'page' : undefined}
		onclick={() => onSelect('providers')}
	>
		<Cpu size={18} />
		<span>Model Providers</span>
		<ChevronRight size={18} class="settings-category-chevron" />
	</button>
</nav>
