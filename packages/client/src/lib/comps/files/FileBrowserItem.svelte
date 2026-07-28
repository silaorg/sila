<script lang="ts">
	import FileIcon from 'lucide-svelte/icons/file';
	import Folder from 'lucide-svelte/icons/folder';
	import type { WorkspaceFsEntry } from '../../api-client';
	import { formatFileSize } from '../chat/format-file-size';

	let {
		entry,
		selected,
		renaming,
		dropTarget,
		fileUrl,
		onSelect,
		onMouseDown,
		onOpen,
		onContextMenu,
		onRename,
		onCancelRename
	}: {
		entry: WorkspaceFsEntry;
		selected: boolean;
		renaming: boolean;
		dropTarget: boolean;
		fileUrl: string;
		onSelect: (event: MouseEvent) => void;
		onMouseDown: (event: MouseEvent) => void;
		onOpen: () => void;
		onContextMenu: (event: MouseEvent) => void;
		onRename: (name: string) => void | Promise<void>;
		onCancelRename: () => void;
	} = $props();

	let editName = $state('');
	let inputElement = $state<HTMLInputElement | null>(null);
	let committingRename = false;
	const isImage = $derived(entry.type === 'file' && entry.kind === 'image');

	$effect(() => {
		if (!renaming) return;
		editName = entry.name;
		queueMicrotask(() => {
			inputElement?.focus();
			inputElement?.select();
		});
	});

	async function commitRename() {
		if (committingRename) return;
		const name = editName.trim();
		if (!name || name === entry.name) {
			onCancelRename();
			return;
		}
		committingRename = true;
		try {
			await onRename(name);
		} finally {
			committingRename = false;
		}
	}
</script>

<div
	class="flex w-32 cursor-pointer select-none flex-col items-center rounded-lg p-3 hover:bg-surface-100-900"
	class:bg-surface-100-900={selected}
	class:outline={dropTarget}
	class:outline-2={dropTarget}
	class:outline-primary-500={dropTarget}
	role="gridcell"
	aria-selected={selected}
	data-testid="filesystem-entry"
	data-path={entry.path}
	data-entry-path={entry.path}
	data-directory-path={entry.type === 'directory' ? entry.path : undefined}
	tabindex="-1"
	onclick={onSelect}
	onmousedown={onMouseDown}
	onkeydown={(event) => {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			onOpen();
		}
	}}
	ondblclick={onOpen}
	oncontextmenu={onContextMenu}
>
	<div class="mb-2 flex size-20 items-center justify-center overflow-hidden rounded">
		{#if entry.type === 'directory'}
			<Folder size={64} class="text-blue-500" />
		{:else if isImage}
			<img
				src={fileUrl}
				alt={entry.name}
				class="size-full object-cover"
				loading="lazy"
			/>
		{:else}
			<FileIcon size={64} class="text-surface-500" />
		{/if}
	</div>

	{#if renaming}
		<input
			class="mb-1 w-full border-0 bg-transparent p-0 text-center text-xs outline-none ring-0"
			bind:this={inputElement}
			bind:value={editName}
			onclick={(event) => event.stopPropagation()}
			onkeydown={(event) => {
				if (event.key === 'Enter') {
					event.preventDefault();
					void commitRename();
				} else if (event.key === 'Escape') {
					event.preventDefault();
					onCancelRename();
				}
			}}
			onblur={() => void commitRename()}
		/>
	{:else}
		<span class="mb-1 w-full truncate text-center text-xs" title={entry.name}>
			{entry.name}
		</span>
	{/if}

	{#if entry.type === 'file'}
		<span class="text-xs text-surface-500">{formatFileSize(entry.size)}</span>
	{/if}
</div>
