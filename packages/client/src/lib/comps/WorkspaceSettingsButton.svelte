<script lang="ts">
	import Settings from 'lucide-svelte/icons/settings-2';
	import { useWorkspaceUi } from '../workspace-ui-context';

	const workspaceUi = useWorkspaceUi();
</script>

<button
	type="button"
	class="chrome-icon-button disabled:opacity-40"
	aria-label="Workspace settings"
	title="Workspace settings"
	disabled={!workspaceUi.currentWorkspaceId}
	onclick={workspaceUi.openSettings}
>
	<Settings size={18} />
</button>
