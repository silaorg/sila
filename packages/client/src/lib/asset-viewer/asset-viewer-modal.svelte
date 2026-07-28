<script lang="ts">
	import Download from 'lucide-svelte/icons/download';
	import File from 'lucide-svelte/icons/file';
	import SquareArrowOutUpRight from 'lucide-svelte/icons/square-arrow-out-up-right';
	import X from 'lucide-svelte/icons/x';
	import { useWorkspaceUi } from '../workspace-ui-context';

	const workspaceUi = useWorkspaceUi();
	const viewer = $derived(workspaceUi.assetViewer);
	const activeFile = $derived(viewer.activeFile);
	const url = $derived(activeFile ? workspaceUi.getWorkspaceAssetUrl(activeFile.path) : '');
	const previewType = $derived.by(() => {
		const mimeType = activeFile?.mimeType ?? '';
		if (mimeType.startsWith('image/')) return 'image';
		if (mimeType.startsWith('video/')) return 'video';
		if (mimeType.startsWith('audio/')) return 'audio';
		if (mimeType === 'application/pdf') return 'pdf';
		if (mimeType.startsWith('text/') || mimeType === 'application/json') return 'text';
		return 'download';
	});
	let text = $state('');
	let textError = $state('');

	$effect(() => {
		const file = activeFile;
		if (!file || previewType !== 'text') {
			text = '';
			textError = '';
			return;
		}
		if (file.size > 2 * 1024 * 1024) {
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

	function handleKeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape' || !activeFile) return;
		event.preventDefault();
		viewer.close();
	}

	function openInTab() {
		if (!activeFile) return;
		workspaceUi.openWorkspaceFileInTab(activeFile);
		viewer.close();
		workspaceUi.swins.clear();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if activeFile}
	<div
		class="fixed inset-0 z-[70] flex cursor-default items-center justify-center bg-black/90"
	>
		<button
			type="button"
			class="absolute inset-0 size-full cursor-default"
			aria-label="Close preview"
			onclick={() => viewer.close()}
		></button>
		<div class="absolute right-4 top-4 z-10 flex flex-col gap-2">
			<button
				type="button"
				class="btn-icon bg-black/50 text-white hover:bg-black/70"
				aria-label="Close"
				onclick={() => viewer.close()}
			>
				<X size={20} />
			</button>
			<a
				class="btn-icon bg-black/50 text-white hover:bg-black/70"
				href={url}
				download={activeFile.name}
				aria-label="Download"
			>
				<Download size={20} />
			</a>
			{#if previewType !== 'download'}
				<button
					type="button"
					class="btn-icon bg-black/50 text-white hover:bg-black/70"
					aria-label="Open in new tab"
					title="Open in new tab"
					onclick={openInTab}
				>
					<SquareArrowOutUpRight size={20} />
				</button>
			{/if}
		</div>

		<div
			class="relative max-h-full max-w-full p-8"
			role="dialog"
			aria-modal="true"
			aria-label={activeFile.name}
			tabindex="-1"
		>
			{#if previewType === 'image'}
				<img
					src={url}
					alt={activeFile.name}
					class="max-h-[calc(100vh-4rem)] max-w-[calc(100vw-4rem)] object-contain"
				/>
			{:else if previewType === 'video'}
				<video
					src={url}
					controls
					autoplay
					class="max-h-[calc(100vh-4rem)] max-w-[calc(100vw-4rem)]"
				>
					<track kind="captions" />
				</video>
			{:else if previewType === 'audio'}
				<div class="w-[min(36rem,calc(100vw-4rem))] rounded bg-surface-50-950 p-6">
					<p class="mb-4 break-words text-sm font-medium">{activeFile.name}</p>
					<audio src={url} controls autoplay class="w-full"><track kind="captions" /></audio>
				</div>
			{:else if previewType === 'pdf'}
				<div
					class="flex h-[calc(100vh-8rem)] w-[min(75rem,calc(100vw-5rem))] flex-col overflow-hidden rounded bg-surface-50-950 shadow-sm"
				>
					<header class="border-b border-surface-200-800 p-4">
						<h3 class="break-words text-sm font-medium">{activeFile.name}</h3>
					</header>
					<iframe src={url} title={activeFile.name} class="min-h-0 flex-1 border-0"></iframe>
				</div>
			{:else if previewType === 'text'}
				<div
					class="flex max-h-[calc(100vh-8rem)] w-[min(56rem,calc(100vw-5rem))] flex-col overflow-hidden rounded bg-surface-50-950 shadow-sm"
				>
					<header class="border-b border-surface-200-800 p-4">
						<h3 class="break-words text-sm font-medium">{activeFile.name}</h3>
					</header>
					<div class="overflow-y-auto p-4">
						{#if textError}
							<p class="text-sm text-surface-500">{textError}</p>
						{:else}
							<pre class="whitespace-pre-wrap break-words font-mono text-sm">{text || 'Loading preview…'}</pre>
						{/if}
					</div>
				</div>
			{:else}
				<div class="max-w-md rounded bg-white p-8 text-center text-black">
					<File size={64} class="mx-auto mb-4" />
					<h3 class="mb-2 text-xl font-medium">{activeFile.name}</h3>
					<p>This file can be downloaded but not previewed.</p>
				</div>
			{/if}
		</div>
	</div>
{/if}
