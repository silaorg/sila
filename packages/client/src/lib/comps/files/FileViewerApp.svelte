<script lang="ts">
	import Download from 'lucide-svelte/icons/download';
	import FileIcon from 'lucide-svelte/icons/file';
	import { useWorkspaceUi } from '../../workspace-ui-context';
	import { formatFileSize } from '../chat/format-file-size';

	let {
		path,
		name,
		mimeType,
		size
	}: {
		path: string;
		name: string;
		mimeType: string;
		size: number;
	} = $props();

	const workspaceUi = useWorkspaceUi();
	const url = $derived(workspaceUi.getWorkspaceAssetUrl(path));
	let text = $state('');
	let textError = $state('');

	$effect(() => {
		if (!mimeType.startsWith('text/') && mimeType !== 'application/json') return;
		if (size > 2 * 1024 * 1024) {
			textError = 'This file is too large to preview.';
			return;
		}
		const controller = new AbortController();
		text = '';
		textError = '';
		void fetch(url, { signal: controller.signal })
			.then((response) => {
				if (!response.ok) throw new Error(`Preview failed with HTTP ${response.status}.`);
				return response.text();
			})
			.then((value) => (text = value))
			.catch((error) => {
				if (error?.name !== 'AbortError') {
					textError = error instanceof Error ? error.message : 'Could not preview file.';
				}
			});
		return () => controller.abort();
	});
</script>

<div class="flex size-full flex-col overflow-hidden">
	<div class="flex items-center justify-between border-b border-surface-200-800 px-4 py-2">
		<div class="min-w-0">
			<p class="truncate text-sm font-medium">{name}</p>
			<p class="text-xs text-surface-500">{formatFileSize(size)}</p>
		</div>
		<a class="btn btn-sm preset-outlined-surface-500 gap-2" href={url} download={name}>
			<Download size={16} />
			Download
		</a>
	</div>

	<div class="min-h-0 flex-1 overflow-auto bg-surface-50-950 p-4">
		{#if mimeType.startsWith('image/')}
			<img src={url} alt={name} class="mx-auto max-h-full max-w-full object-contain" />
		{:else if mimeType === 'application/pdf'}
			<iframe src={url} title={name} class="size-full border-0"></iframe>
		{:else if mimeType.startsWith('text/') || mimeType === 'application/json'}
			{#if textError}
				<p class="text-sm text-surface-500">{textError}</p>
			{:else}
				<pre class="whitespace-pre-wrap break-words font-mono text-sm">{text || 'Loading preview…'}</pre>
			{/if}
		{:else}
			<div class="flex h-full flex-col items-center justify-center text-center">
				<FileIcon size={64} class="text-surface-500" />
				<p class="mt-4 font-medium">{name}</p>
				<p class="mt-1 text-sm text-surface-500">Preview is not available for this file type.</p>
			</div>
		{/if}
	</div>
</div>
