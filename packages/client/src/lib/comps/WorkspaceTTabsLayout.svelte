<script lang="ts">
	import { TTabsRoot } from 'ttabs-svelte';
	import { onMount, tick } from 'svelte';
	import { useWorkspaceUi } from '../workspace-ui-context';
	import WorkspaceSidebar from './WorkspaceSidebar.svelte';

	const workspaceUi = useWorkspaceUi();
	const layout = workspaceUi.layout;
	let navigation: HTMLElement | undefined = $state();

	onMount(() => {
		const media = window.matchMedia('(max-width: 720px)');
		const update = () => layout.setMobile(media.matches);
		update();
		media.addEventListener('change', update);
		return () => media.removeEventListener('change', update);
	});

	$effect(() => {
		if (!layout.mobileSidebarOpen) return;
		const previousFocus = document.activeElement;
		void tick().then(() => navigation?.focus());
		return () => {
			if (previousFocus instanceof HTMLElement) previousFocus.focus();
		};
	});

	function handleNavigationKey(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			layout.mobileSidebarOpen = false;
		}
		if (event.key !== 'Tab' || !navigation) return;
		const buttons = Array.from(navigation.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input'));
		const first = buttons[0];
		const last = buttons.at(-1);
		if (event.shiftKey && (document.activeElement === first || document.activeElement === navigation)) {
			event.preventDefault();
			last?.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first?.focus();
		}
	}
</script>

<div class="workspace-tiles" inert={layout.mobileSidebarOpen}>
	<TTabsRoot ttabs={layout.ttabs} />
</div>

{#if layout.isMobile && layout.mobileSidebarOpen}
	<div class="mobile-navigation-layer">
		<button class="app-backdrop" type="button" aria-label="Close navigation" tabindex="-1" onclick={() => layout.mobileSidebarOpen = false}></button>
		<div class="mobile-navigation" role="dialog" aria-modal="true" aria-label="Workspace navigation" tabindex="-1" bind:this={navigation} onkeydown={handleNavigationKey}>
			<WorkspaceSidebar mobile />
		</div>
	</div>
{/if}
