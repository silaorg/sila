<script lang="ts">
	import FileText from 'lucide-svelte/icons/file-text';
	import Loader2 from 'lucide-svelte/icons/loader-circle';
	import type { WorkspaceFile } from '../../api-client';
	import { formatFileSize } from './format-file-size';

	let {
		attachment,
		url,
		loading = false,
		onRemove
	}: {
		attachment: WorkspaceFile;
		url: string;
		loading?: boolean;
		onRemove: (reference: string) => void;
	} = $props();
</script>

<div
	class="group relative rounded-md bg-surface-100-900 p-1"
	class:border={loading}
	class:border-dashed={loading}
	class:border-surface-300-700={loading}
>
	{#if loading}
		<div class="flex items-center gap-2 px-2 py-1">
			<Loader2 size={14} class="animate-spin text-primary-500" />
			<div class="text-xs opacity-70">{attachment.name}</div>
		</div>
	{:else if attachment.kind === 'image'}
		<img src={url} alt={attachment.name} class="max-h-16 max-w-24 rounded" />
	{:else}
		<div class="flex items-center gap-2 rounded border border-surface-300-700 px-2 py-1 text-xs opacity-70">
			<FileText size={15} />
			<div>
				<div class="max-w-40 truncate font-medium">{attachment.name}</div>
				<div class="text-[11px] opacity-60">{formatFileSize(attachment.size)}</div>
			</div>
		</div>
	{/if}

	<button
		type="button"
		class="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-surface-200-800 hover:bg-surface-300-700"
		onclick={() => onRemove(attachment.reference)}
		aria-label={`Remove ${attachment.name}`}
	>
		×
	</button>
</div>
