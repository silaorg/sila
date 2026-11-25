<script lang="ts">
	import { TTabsRoot } from 'ttabs-svelte';
	import { onMount, tick } from 'svelte';
	import { useWorkspaceUi } from '../workspace-ui-context';
	import { trapFocus } from '../utils/trap-focus';
	import WorkspaceSidebar from './WorkspaceSidebar.svelte';

	const workspaceUi = useWorkspaceUi();
	const layout = workspaceUi.layout;
	let navigation: HTMLElement | undefined = $state();

	onMount(() => {
		const mobile = window.matchMedia('(max-width: 720px)');
		const compact = window.matchMedia('(max-width: 900px)');
		const update = () => layout.setViewport(mobile.matches, compact.matches);
		update();
		mobile.addEventListener('change', update);
		compact.addEventListener('change', update);
		return () => {
			mobile.removeEventListener('change', update);
			compact.removeEventListener('change', update);
		};
	});

	$effect(() => {
		if (!layout.overlaySidebarOpen) return;
		const previousFocus = document.activeElement;
		void tick().then(() => navigation?.focus());
		return () => {
			if (previousFocus instanceof HTMLElement) previousFocus.focus();
		};
	});

	function handleNavigationKey(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			layout.overlaySidebarOpen = false;
		}
		trapFocus(event);
	}
</script>

<div
	class="workspace-tiles"
	class:workspace-sidebar-overlay={layout.usesSidebarOverlay}
	inert={layout.overlaySidebarOpen}
>
	<TTabsRoot ttabs={layout.ttabs} />
</div>

{#if layout.overlaySidebarOpen}
	<div class="mobile-navigation-layer">
		<button
			class="app-backdrop"
			type="button"
			aria-label="Close navigation"
			tabindex="-1"
			onclick={() => layout.overlaySidebarOpen = false}
		></button>
		<div
			class="mobile-navigation"
			role="dialog"
			aria-modal="true"
			aria-label="Workspace navigation"
			tabindex="-1"
			bind:this={navigation}
			onkeydown={handleNavigationKey}
		>
			<WorkspaceSidebar overlay />
		</div>
	</div>
{/if}
