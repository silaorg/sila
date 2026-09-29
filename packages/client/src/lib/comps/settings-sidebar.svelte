<script lang="ts">
	import Cpu from 'lucide-svelte/icons/cpu';
	import Settings from 'lucide-svelte/icons/settings';

	let {
		active,
		onSelect
	}: {
		active: 'preferences' | 'providers';
		onSelect: (page: 'preferences' | 'providers') => void;
	} = $props();

	function buttonClass(page: 'preferences' | 'providers') {
		return `w-full flex gap-2 items-center py-2 px-3 rounded hover:preset-tonal ${
			active === page ? 'preset-tonal' : ''
		}`;
	}
</script>

<nav class="flex w-full gap-1 sm:w-48 sm:shrink-0 sm:flex-col sm:self-start">
	<div class="hidden px-3 pb-1 pt-2 sm:block text-xs font-medium uppercase tracking-wide text-surface-600-300">
		Workspace
	</div>

	<button
		type="button"
		class={buttonClass('preferences')}
		onclick={() => onSelect('preferences')}
	>
		<Settings size={18} />
		<span>Preferences</span>
	</button>

	<button
		type="button"
		class={buttonClass('providers')}
		onclick={() => onSelect('providers')}
	>
		<Cpu size={18} />
		<span>Model Providers</span>
	</button>
</nav>
