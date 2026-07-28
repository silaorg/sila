<script lang="ts">
	import { TTabsRoot } from 'ttabs-svelte';
	import { useWorkspaceUi } from '../workspace-ui-context';

	const workspaceUi = useWorkspaceUi();
</script>

<TTabsRoot ttabs={workspaceUi.layout.ttabs} />
