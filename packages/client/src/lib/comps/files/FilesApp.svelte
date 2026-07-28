<script lang="ts">
	import { untrack } from 'svelte';
	import FolderPlus from 'lucide-svelte/icons/folder-plus';
	import RefreshCw from 'lucide-svelte/icons/refresh-cw';
	import Upload from 'lucide-svelte/icons/upload';
	import type { WorkspaceFsEntry } from '../../api-client';
	import { useWorkspaceUi } from '../../workspace-ui-context';
	import DragOverlay from './drag-overlay.svelte';
	import FileBrowserBreadcrumbs from './FileBrowserBreadcrumbs.svelte';
	import FileBrowserItem from './FileBrowserItem.svelte';

	let {
		onFileOpen,
		onSelectionChange
	}: {
		onFileOpen?: (entry: Extract<WorkspaceFsEntry, { type: 'file' }>) => void;
		onSelectionChange?: (entries: WorkspaceFsEntry[]) => void;
	} = $props();

	const workspaceUi = useWorkspaceUi();
	let fileInput = $state<HTMLInputElement | null>(null);
	let grid = $state<HTMLDivElement | null>(null);
	let entries = $state<WorkspaceFsEntry[]>([]);
	let currentPath = $state('');
	let selectedPaths = $state<Set<string>>(new Set());
	let focusedPath = $state<string | null>(null);
	let renamingPath = $state<string | null>(null);
	let creatingFolder = $state(false);
	let creatingFolderPending = false;
	let newFolderName = $state('New folder');
	let newFolderInput = $state<HTMLInputElement | null>(null);
	let loading = $state(true);
	let uploading = $state(false);
	let externalDragOver = $state(false);
	let errorMessage = $state('');
	let menu = $state<{ x: number; y: number } | null>(null);
	let dragCandidate = $state<{ path: string; startX: number; startY: number } | null>(null);
	let dragging = $state(false);
	let dragX = $state(0);
	let dragY = $state(0);
	let dropTargetPath = $state<string | null>(null);
	let marqueeCandidate = $state<{ startX: number; startY: number } | null>(null);
	let marqueeRect = $state<{ x: number; y: number; width: number; height: number } | null>(null);
	let suppressEmptyClick = false;
	let loadRequest = 0;
	let loadedWorkspaceId: string | null = null;

	const selectedEntries = $derived(entries.filter((entry) => selectedPaths.has(entry.path)));
	const selectedEntry = $derived(selectedEntries.length === 1 ? selectedEntries[0] : null);

	$effect(() => {
		workspaceUi.filesystemVersion;
		const workspaceId = workspaceUi.currentWorkspaceId;
		const path = workspaceId === loadedWorkspaceId ? untrack(() => currentPath) : '';
		loadedWorkspaceId = workspaceId;
		void loadDirectory(path);
	});

	$effect(() => {
		onSelectionChange?.(selectedEntries);
	});

	$effect(() => {
		if (!creatingFolder) return;
		queueMicrotask(() => {
			newFolderInput?.focus();
			newFolderInput?.select();
		});
	});

	async function loadDirectory(path = currentPath) {
		const request = ++loadRequest;
		loading = true;
		errorMessage = '';
		try {
			const result = await workspaceUi.listWorkspaceDirectory(path);
			if (request !== loadRequest) return;
			currentPath = path;
			entries = result;
			clearSelection();
			renamingPath = null;
		} catch (error) {
			if (request === loadRequest) {
				errorMessage = error instanceof Error ? error.message : 'Could not load files.';
			}
		} finally {
			if (request === loadRequest) loading = false;
		}
	}

	function clearSelection() {
		selectedPaths = new Set();
		focusedPath = null;
	}

	function selectSingle(entry: WorkspaceFsEntry) {
		selectedPaths = new Set([entry.path]);
		focusedPath = entry.path;
	}

	function selectEntry(event: MouseEvent, entry: WorkspaceFsEntry) {
		grid?.focus();
		if (event.shiftKey && focusedPath) {
			const start = entries.findIndex((item) => item.path === focusedPath);
			const end = entries.findIndex((item) => item.path === entry.path);
			if (start >= 0 && end >= 0) {
				const [from, to] = start <= end ? [start, end] : [end, start];
				selectedPaths = new Set(entries.slice(from, to + 1).map((item) => item.path));
				return;
			}
		}
		if (event.metaKey || event.ctrlKey) {
			const next = new Set(selectedPaths);
			if (next.has(entry.path)) next.delete(entry.path);
			else next.add(entry.path);
			selectedPaths = next;
			focusedPath = entry.path;
			return;
		}
		selectSingle(entry);
	}

	function openEntry(entry: WorkspaceFsEntry) {
		menu = null;
		if (entry.type === 'directory') void loadDirectory(entry.path);
		else if (onFileOpen) onFileOpen(entry);
		else workspaceUi.openWorkspaceFile(entry);
	}

	function startItemDrag(event: MouseEvent, entry: WorkspaceFsEntry) {
		if (event.button !== 0 || renamingPath || menu) return;
		event.preventDefault();
		if (!selectedPaths.has(entry.path) && !event.shiftKey && !(event.metaKey || event.ctrlKey)) {
			selectSingle(entry);
		}
		dragCandidate = { path: entry.path, startX: event.clientX, startY: event.clientY };
		window.addEventListener('mousemove', handleWindowMouseMove);
		window.addEventListener('mouseup', handleWindowMouseUp, { once: true });
	}

	function handleWindowMouseMove(event: MouseEvent) {
		if (dragCandidate && !dragging) {
			const dx = Math.abs(event.clientX - dragCandidate.startX);
			const dy = Math.abs(event.clientY - dragCandidate.startY);
			if (dx > 4 || dy > 4) dragging = true;
		}
		dragX = event.clientX;
		dragY = event.clientY;

		if (dragging) {
			const element = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
			const target = element?.closest<HTMLElement>('[data-directory-path]');
			const path = target?.dataset.directoryPath;
			dropTargetPath =
				path !== undefined && !selectedPaths.has(path) ? path : null;
		}

		if (!marqueeCandidate) return;
		const left = Math.min(marqueeCandidate.startX, event.clientX);
		const top = Math.min(marqueeCandidate.startY, event.clientY);
		const right = Math.max(marqueeCandidate.startX, event.clientX);
		const bottom = Math.max(marqueeCandidate.startY, event.clientY);
		if (right - left <= 3 && bottom - top <= 3) return;
		marqueeRect = { x: left, y: top, width: right - left, height: bottom - top };
		const next = new Set<string>();
		for (const tile of grid?.querySelectorAll<HTMLElement>('[data-entry-path]') ?? []) {
			const bounds = tile.getBoundingClientRect();
			if (
				left <= bounds.right &&
				right >= bounds.left &&
				top <= bounds.bottom &&
				bottom >= bounds.top
			) {
				const path = tile.dataset.entryPath;
				if (path) next.add(path);
			}
		}
		selectedPaths = next;
	}

	async function handleWindowMouseUp() {
		window.removeEventListener('mousemove', handleWindowMouseMove);
		const destination = dropTargetPath;
		const paths = [...selectedPaths];
		const didDrag = dragging;
		dragCandidate = null;
		dragging = false;
		dropTargetPath = null;
		marqueeCandidate = null;
		if (marqueeRect) {
			suppressEmptyClick = true;
			marqueeRect = null;
		}
		if (!didDrag || destination === null || paths.length === 0) return;
		errorMessage = '';
		try {
			await workspaceUi.moveWorkspaceEntries(paths, destination);
			await loadDirectory();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Could not move items.';
		}
	}

	function beginMarquee(event: MouseEvent) {
		if (event.button !== 0 || event.target !== grid) return;
		event.preventDefault();
		clearSelection();
		marqueeCandidate = { startX: event.clientX, startY: event.clientY };
		window.addEventListener('mousemove', handleWindowMouseMove);
		window.addEventListener('mouseup', handleWindowMouseUp, { once: true });
	}

	async function upload(files: File[]) {
		if (uploading || files.length === 0) return;
		uploading = true;
		errorMessage = '';
		try {
			await workspaceUi.uploadWorkspaceFiles(currentPath, files);
			await loadDirectory();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Could not upload files.';
		} finally {
			uploading = false;
			if (fileInput) fileInput.value = '';
		}
	}

	async function createFolder() {
		if (creatingFolderPending) return;
		const name = newFolderName.trim();
		if (!name) {
			creatingFolder = false;
			return;
		}
		creatingFolderPending = true;
		errorMessage = '';
		try {
			const created = await workspaceUi.createWorkspaceDirectory(currentPath, name);
			creatingFolder = false;
			await loadDirectory();
			selectedPaths = new Set([created.path]);
			focusedPath = created.path;
			renamingPath = created.path;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Could not create folder.';
		} finally {
			creatingFolderPending = false;
		}
	}

	async function renameEntry(entry: WorkspaceFsEntry, name: string) {
		errorMessage = '';
		try {
			const renamed = await workspaceUi.renameWorkspaceEntry(entry.path, name);
			renamingPath = null;
			await loadDirectory();
			selectedPaths = new Set([renamed.path]);
			focusedPath = renamed.path;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Could not rename item.';
		}
	}

	async function deleteSelected() {
		if (selectedEntries.length === 0) return;
		if (!confirm(`Delete ${selectedEntries.length === 1 ? selectedEntries[0].name : `${selectedEntries.length} items`}?`)) return;
		menu = null;
		errorMessage = '';
		try {
			for (const entry of selectedEntries) {
				await workspaceUi.removeWorkspaceEntry(entry.path);
			}
			await loadDirectory();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Could not delete items.';
		}
	}

	function beginCreateFolder() {
		newFolderName = 'New folder';
		creatingFolder = true;
		clearSelection();
		menu = null;
	}

	function showContextMenu(event: MouseEvent, entry: WorkspaceFsEntry) {
		event.preventDefault();
		event.stopPropagation();
		if (!selectedPaths.has(entry.path)) selectSingle(entry);
		menu = { x: event.clientX, y: event.clientY };
	}

	function handleKeydown(event: KeyboardEvent) {
		if (renamingPath || creatingFolder || menu) return;
		if (event.key === 'Backspace' && currentPath) {
			event.preventDefault();
			void loadDirectory(currentPath.split('/').filter(Boolean).slice(0, -1).join('/'));
		} else if (event.key === 'Enter' && selectedEntry) {
			event.preventDefault();
			openEntry(selectedEntry);
		} else if (event.key === 'F2' && selectedEntry) {
			event.preventDefault();
			renamingPath = selectedEntry.path;
		} else if (event.key === 'Delete' && selectedEntries.length > 0) {
			event.preventDefault();
			void deleteSelected();
		} else if (event.key === 'Escape') {
			clearSelection();
		}
	}
</script>

<svelte:window onclick={() => (menu = null)} />

<div
	class="flex size-full flex-col overflow-hidden"
	data-testid="files-app"
	role="region"
	aria-label="Files application"
	ondragover={(event) => {
		if (!event.dataTransfer?.types.includes('Files')) return;
		event.preventDefault();
		externalDragOver = true;
	}}
	ondragleave={(event) => {
		if (event.currentTarget === event.target) externalDragOver = false;
	}}
	ondrop={(event) => {
		event.preventDefault();
		externalDragOver = false;
		void upload(Array.from(event.dataTransfer?.files ?? []));
	}}
>
	<input
		type="file"
		multiple
		class="hidden"
		bind:this={fileInput}
		onchange={(event) => void upload(Array.from(event.currentTarget.files ?? []))}
	/>

	<div
		class="min-h-0 flex-1 cursor-default overflow-y-auto p-4"
		class:bg-primary-50-950={externalDragOver}
		class:border-2={externalDragOver}
		class:border-dashed={externalDragOver}
		class:border-primary-500={externalDragOver}
	>
		<div class="mx-auto w-full max-w-4xl">
			<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
				<FileBrowserBreadcrumbs path={currentPath} onNavigate={(path) => void loadDirectory(path)} />
				<div class="flex items-center gap-2">
					<button
						type="button"
						class="btn btn-sm preset-outline gap-2"
						disabled={uploading}
						onclick={() => fileInput?.click()}
					>
						{#if uploading}
							<span class="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
							Uploading
						{:else}
							<Upload size={16} />
							Upload files
						{/if}
					</button>
					<button type="button" class="btn btn-sm preset-outline gap-2" onclick={beginCreateFolder}>
						<FolderPlus size={16} />
						New folder
					</button>
					<button
						type="button"
						class="rounded p-2 hover:preset-tonal"
						aria-label="Refresh files"
						onclick={() => void loadDirectory()}
					>
						<RefreshCw size={16} />
					</button>
				</div>
			</div>

			{#if errorMessage}
				<div class="alert preset-tonal-error mb-4">{errorMessage}</div>
			{/if}

			{#if loading && entries.length === 0}
				<p class="py-8 text-sm text-surface-500">Loading files…</p>
			{:else}
				<div
					class="flex min-h-32 flex-wrap content-start gap-3 select-none focus:outline-none"
					bind:this={grid}
					role="grid"
					tabindex="0"
					aria-label="Workspace files and folders"
					onkeydown={handleKeydown}
					onmousedown={beginMarquee}
					onclick={(event) => {
						if (event.target !== grid) return;
						if (suppressEmptyClick) suppressEmptyClick = false;
						else clearSelection();
					}}
				>
					{#if creatingFolder}
						<div class="flex w-32 flex-col items-center rounded-lg bg-surface-100-900 p-3">
							<div class="mb-2 flex size-20 items-center justify-center">
								<FolderPlus size={64} class="text-blue-500" />
							</div>
							<input
								class="w-full border-0 bg-transparent p-0 text-center text-xs outline-none ring-0"
								bind:this={newFolderInput}
								bind:value={newFolderName}
								onkeydown={(event) => {
									if (event.key === 'Enter') {
										event.preventDefault();
										void createFolder();
									} else if (event.key === 'Escape') creatingFolder = false;
								}}
								onblur={() => void createFolder()}
							/>
						</div>
					{/if}

					{#each entries as entry (entry.path)}
						<FileBrowserItem
							{entry}
							selected={selectedPaths.has(entry.path)}
							renaming={renamingPath === entry.path}
							dropTarget={dropTargetPath === entry.path}
							fileUrl={entry.type === 'file' ? workspaceUi.getWorkspaceAssetUrl(entry.path) : ''}
							onSelect={(event) => selectEntry(event, entry)}
							onMouseDown={(event) => startItemDrag(event, entry)}
							onOpen={() => openEntry(entry)}
							onContextMenu={(event) => showContextMenu(event, entry)}
							onRename={(name) => renameEntry(entry, name)}
							onCancelRename={() => (renamingPath = null)}
						/>
					{/each}
				</div>

				{#if !loading && entries.length === 0 && !creatingFolder}
					<p class="py-8 text-sm text-surface-500">
						This folder is empty.
						<button type="button" class="anchor" onclick={() => fileInput?.click()}>Upload a file</button>
						or move files here.
					</p>
				{/if}
			{/if}
		</div>
	</div>
</div>

{#if menu && selectedEntries.length > 0}
	<div
		class="fixed z-[60] w-48 rounded-lg border border-surface-200-800 bg-surface-50-950 p-1 shadow-xl"
		style={`left:${menu.x}px; top:${menu.y}px`}
		role="menu"
		tabindex="-1"
	>
		<button
			type="button"
			class="btn btn-sm w-full justify-start"
			disabled={!selectedEntry}
			onclick={() => selectedEntry && openEntry(selectedEntry)}
		>
			Open
		</button>
		<button
			type="button"
			class="btn btn-sm w-full justify-start"
			disabled={!selectedEntry || selectedEntry.type !== 'file'}
			onclick={() => {
				if (selectedEntry?.type === 'file') {
					workspaceUi.openWorkspaceFileInTab(selectedEntry);
					workspaceUi.swins.clear();
				}
				menu = null;
			}}
		>
			Open in new tab
		</button>
		<button
			type="button"
			class="btn btn-sm w-full justify-start"
			disabled={!selectedEntry}
			onclick={() => {
				if (selectedEntry) renamingPath = selectedEntry.path;
				menu = null;
			}}
		>
			Rename
		</button>
		<button type="button" class="btn btn-sm w-full justify-start text-error-500" onclick={() => void deleteSelected()}>
			Delete
		</button>
	</div>
{/if}

{#if marqueeRect}
	<div
		class="pointer-events-none fixed z-[9998] border border-primary-500/60 bg-primary-500/10"
		style={`left:${marqueeRect.x}px; top:${marqueeRect.y}px; width:${marqueeRect.width}px; height:${marqueeRect.height}px`}
	></div>
{/if}

{#if dragging}
	<DragOverlay items={selectedEntries} x={dragX} y={dragY} />
{/if}
