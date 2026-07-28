<script lang="ts">
	import { computePosition, flip, offset, shift } from '@floating-ui/dom';
	import FileText from 'lucide-svelte/icons/file-text';
	import type { FileMention } from './chat-mention-plugin';

	let {
		files,
		selectedIndex,
		coords,
		onFilePick,
		onClose
	}: {
		files: FileMention[];
		selectedIndex: number;
		coords: { x: number; y: number };
		onFilePick: (file: FileMention, event?: MouseEvent) => void;
		onClose: () => void;
	} = $props();

	let menuElement: HTMLDivElement | null = $state(null);
	let hoveredIndex = $state<number | null>(null);
	let previewFile = $derived(
		hoveredIndex !== null ? files[hoveredIndex] : files[selectedIndex]
	);

	async function updatePosition() {
		if (!menuElement) return;
		const reference = {
			getBoundingClientRect: () => ({
				x: coords.x,
				y: coords.y,
				left: coords.x,
				right: coords.x,
				top: coords.y,
				bottom: coords.y,
				width: 0,
				height: 0
			}) as DOMRect
		};
		const position = await computePosition(reference, menuElement, {
			placement: 'bottom-start',
			strategy: 'fixed',
			middleware: [offset(4), flip(), shift({ padding: 8 })]
		});
		menuElement.style.left = `${position.x}px`;
		menuElement.style.top = `${position.y}px`;
	}

	$effect(() => {
		if (menuElement) void updatePosition();
	});
</script>

<div
	bind:this={menuElement}
	class="card fixed z-50 flex rounded-md border border-surface-100-900 bg-surface-50-950 text-sm shadow-lg"
	role="menu"
	tabindex="-1"
	onmousedown={(event) => event.stopPropagation()}
	onkeydown={(event) => {
		if (event.key === 'Escape') onClose();
	}}
>
	<div class="min-w-[240px] p-2">
		<p class="mb-2 text-xs font-semibold uppercase tracking-wide">Mention a file</p>
		<div class="flex max-h-64 flex-col gap-1 overflow-y-auto">
			{#each files as file, index (file.reference)}
				<button
					type="button"
					class="flex items-center gap-2 rounded px-2 py-1 text-left hover:bg-surface-100-900"
					class:bg-surface-100-900={index === selectedIndex}
					onmouseenter={() => hoveredIndex = index}
					onmouseleave={() => hoveredIndex = null}
					onmousedown={(event) => {
						event.preventDefault();
						onFilePick(file, event);
					}}
				>
					<FileText size={15} class="shrink-0 opacity-60" />
					<span class="min-w-0">
						<span class="block truncate">{file.name}</span>
						<span class="block truncate text-[11px] opacity-50">{file.path}</span>
					</span>
				</button>
			{/each}
			{#if files.length === 0}
				<div class="px-2 py-2 text-xs opacity-60">No files found</div>
			{/if}
		</div>
	</div>

	{#if previewFile}
		<div class="flex w-[280px] items-center justify-center border-l border-surface-100-900 p-3">
			{#if previewFile.kind === 'image'}
				<img
					src={previewFile.url}
					alt={previewFile.name}
					class="max-h-[200px] max-w-full rounded object-contain"
				/>
			{:else}
				<div class="flex h-32 w-full flex-col items-center justify-center rounded bg-surface-100-900 p-4 text-center">
					<FileText size={28} class="mb-2 opacity-50" />
					<span class="max-w-full truncate text-xs">{previewFile.name}</span>
					<span class="mt-1 text-[11px] opacity-50">{previewFile.mimeType}</span>
				</div>
			{/if}
		</div>
	{/if}
</div>
