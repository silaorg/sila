<script lang="ts">
	import Download from 'lucide-svelte/icons/download';
	import FileText from 'lucide-svelte/icons/file-text';
	import type { WorkspaceFile } from '../../api-client';
	import { useWorkspaceUi } from '../../workspace-ui-context';
	import { formatFileSize } from './format-file-size';

	let {
		attachment,
		threadId
	}: {
		attachment: WorkspaceFile;
		threadId: string;
	} = $props();
	const workspaceUi = useWorkspaceUi();
	let url = $derived(workspaceUi.getFileUrl(threadId, attachment.reference));
</script>

<a
	href={url}
	target="_blank"
	rel="noreferrer"
	class="group block max-w-64 overflow-hidden rounded-lg border border-surface-300-700 bg-surface-50-950"
>
	{#if attachment.kind === 'image'}
		<img src={url} alt={attachment.name} class="max-h-48 w-full object-cover" />
	{:else}
		<div class="flex items-center gap-2 p-3">
			<FileText size={20} class="shrink-0 opacity-60" />
			<div class="min-w-0 flex-1">
				<div class="truncate text-xs font-medium">{attachment.name}</div>
				<div class="text-[11px] opacity-50">{formatFileSize(attachment.size)}</div>
			</div>
			<Download size={16} class="opacity-0 transition-opacity group-hover:opacity-60" />
		</div>
	{/if}
</a>
