<script lang="ts">
	import PanelLeftClose from 'lucide-svelte/icons/panel-left-close';
	import PanelLeftOpen from 'lucide-svelte/icons/panel-left-open';
	import { useWorkspaceUi } from '../workspace-ui-context';

	const workspaceUi = useWorkspaceUi();
</script>

<button
	type="button"
	class="rounded p-2 hover:preset-tonal"
	onclick={() => workspaceUi.layout.sidebar.toggle()}
	title={workspaceUi.layout.sidebar.isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
	aria-label={workspaceUi.layout.sidebar.isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
>
	{#if workspaceUi.layout.sidebar.isOpen}
		<PanelLeftClose size={18} />
	{:else}
		<PanelLeftOpen size={18} />
	{/if}
</button>
