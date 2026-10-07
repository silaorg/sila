<script lang="ts">
	import PanelLeftClose from 'lucide-svelte/icons/panel-left-close';
	import PanelLeftOpen from 'lucide-svelte/icons/panel-left-open';
	import { useWorkspaceUi } from '../workspace-ui-context';

	const workspaceUi = useWorkspaceUi();
	const expanded = $derived(workspaceUi.layout.isMobile ? workspaceUi.layout.mobileSidebarOpen : workspaceUi.layout.sidebar.isOpen);
</script>

<button
	type="button"
	class="chrome-icon-button"
	onclick={() => workspaceUi.layout.sidebar.toggle()}
	title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
	aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
	aria-expanded={expanded}
>
	{#if expanded}
		<PanelLeftClose size={18} />
	{:else}
		<PanelLeftOpen size={18} />
	{/if}
</button>
