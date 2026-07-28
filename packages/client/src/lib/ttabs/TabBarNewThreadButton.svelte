<script lang="ts">
	import Plus from 'lucide-svelte/icons/plus';
	import IconButton from '../comps/ui/IconButton.svelte';
	import { useWorkspaceUi } from '../workspace-ui-context';

	let { panelId }: { panelId: string } = $props();
	const workspaceUi = useWorkspaceUi();
</script>

<IconButton
	ariaLabel="New thread"
	title="New thread (⌘T)"
	disabled={!workspaceUi.currentWorkspaceId}
	onclick={() => void workspaceUi.createThread(panelId)}
	className="ml-4"
>
	{#snippet children()}
		<Plus size={16} />
	{/snippet}
</IconButton>
