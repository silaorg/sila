<script lang="ts">
	import FolderOpen from 'lucide-svelte/icons/folder-open';
	import ImageIcon from 'lucide-svelte/icons/image';
	import Plus from 'lucide-svelte/icons/plus';
	import Send from 'lucide-svelte/icons/send';
	import type { WorkspaceFile, WorkspaceFsEntry } from '../../api-client';
	import { swinsLayout } from '../../swins/swins-layout';
	import { useWorkspaceUi } from '../../workspace-ui-context';
	import ContextMenu from '../ui/context-menu.svelte';
	import AttachmentPreviewItem from './attachment-preview-item.svelte';
	import ChatEditor from './chat-editor.svelte';
	import type { FileMention } from './chat-mention-plugin';

	const MAX_ATTACHMENT_COUNT = 8;
	const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
	const MAX_TOTAL_ATTACHMENT_BYTES = 40 * 1024 * 1024;

	let {
		threadId,
		disabled = false,
		onSend,
		onError
	}: {
		threadId: string;
		disabled?: boolean;
		onSend: (text: string, attachments: string[]) => Promise<void>;
		onError: (message: string) => void;
	} = $props();

	const workspaceUi = useWorkspaceUi();
	let query = $state('');
	let attachmentMenuOpen = $state(false);
	let fileInput: HTMLInputElement | null = $state(null);
	let editor: { insertFileMentionAtCursor: (file: FileMention) => void } | null = $state(null);
	let attachments = $state<Array<{
		file: WorkspaceFile;
		url: string;
		loading: boolean;
	}>>([]);

	let canSend = $derived(
		!disabled
		&& attachments.every((attachment) => !attachment.loading)
		&& (query.trim().length > 0 || attachments.length > 0)
	);

	function toMention(file: WorkspaceFile): FileMention {
		return {
			...file,
			url: workspaceUi.getFileUrl(threadId, file.reference)
		};
	}

	async function searchFiles(search: string) {
		try {
			const files = await workspaceUi.listFiles(threadId, search);
			return files.map(toMention);
		} catch (error) {
			onError(errorMessage(error, 'Could not list workspace files.'));
			return [];
		}
	}

	function openWorkspaceFilePicker() {
		attachmentMenuOpen = false;
		workspaceUi.swins.open(
			swinsLayout.filePicker.key,
			{ onPick: insertWorkspaceFiles },
			'Workspace files'
		);
	}

	function insertWorkspaceFiles(
		files: Array<Extract<WorkspaceFsEntry, { type: 'file' }>>
	) {
		for (const file of files) {
			editor?.insertFileMentionAtCursor({
				reference: file.reference,
				scope: file.scope,
				path: file.path,
				name: file.name,
				size: file.size,
				mimeType: file.mimeType,
				kind: file.kind,
				url: workspaceUi.getWorkspaceAssetUrl(file.path)
			});
		}
	}

	async function addFiles(files: File[]) {
		if (files.length === 0) return;
		const remaining = MAX_ATTACHMENT_COUNT - attachments.length;
		if (remaining <= 0 || files.length > remaining) {
			onError(`You can attach up to ${MAX_ATTACHMENT_COUNT} files.`);
			return;
		}
		if (files.some((file) => file.size > MAX_ATTACHMENT_BYTES)) {
			onError('Each attachment must be 20 MB or smaller.');
			return;
		}
		const totalBytes = [
			...attachments.map((attachment) => attachment.file.size),
			...files.map((file) => file.size)
		].reduce((sum, size) => sum + size, 0);
		if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
			onError('Attachments must be 40 MB or smaller in total.');
			return;
		}

		const pending = files.map((file) => ({
			file: {
				reference: `pending:${crypto.randomUUID()}`,
				scope: 'thread' as const,
				path: '',
				name: file.name,
				size: file.size,
				mimeType: file.type || 'application/octet-stream',
				kind: file.type.startsWith('image/') ? 'image' as const : 'file' as const
			},
			url: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
			loading: true
		}));
		attachments = [...attachments, ...pending];
		attachmentMenuOpen = false;

		try {
			const uploaded = await workspaceUi.uploadFiles(threadId, files);
			const activePendingReferences = new Set(
				attachments.map((attachment) => attachment.file.reference)
			);
			const pendingIndexes = new Map(
				pending.map((attachment, index) => [attachment.file.reference, index])
			);
			attachments = attachments.map((attachment) => {
				const index = pendingIndexes.get(attachment.file.reference);
				if (index === undefined) return attachment;
				if (attachment.url.startsWith('blob:')) URL.revokeObjectURL(attachment.url);
				const file = uploaded[index];
				return file
					? { file, url: workspaceUi.getFileUrl(threadId, file.reference), loading: false }
					: attachment;
			});
			for (const [index, pendingAttachment] of pending.entries()) {
				if (!activePendingReferences.has(pendingAttachment.file.reference) && uploaded[index]) {
					void workspaceUi.removeUploadedFile(threadId, uploaded[index].reference).catch((error) => {
						onError(errorMessage(error, 'Could not remove the uploaded file.'));
					});
				}
			}
		} catch (error) {
			const pendingReferences = new Set(pending.map((item) => item.file.reference));
			for (const attachment of pending) {
				if (attachment.url.startsWith('blob:')) URL.revokeObjectURL(attachment.url);
			}
			attachments = attachments.filter(
				(attachment) => !pendingReferences.has(attachment.file.reference)
			);
			onError(errorMessage(error, 'Could not upload the files.'));
		}
	}

	function removeAttachment(reference: string) {
		const item = attachments.find((attachment) => attachment.file.reference === reference);
		if (item?.url.startsWith('blob:')) URL.revokeObjectURL(item.url);
		attachments = attachments.filter((attachment) => attachment.file.reference !== reference);
		if (item && !item.loading && item.file.scope === 'thread') {
			void workspaceUi.removeUploadedFile(threadId, item.file.reference).catch((error) => {
				onError(errorMessage(error, 'Could not remove the uploaded file.'));
			});
		}
	}

	async function send() {
		if (!canSend) return;
		const text = query;
		const sentAttachments = attachments;
		const references = attachments.map((attachment) => attachment.file.reference);
		query = '';
		attachments = [];
		try {
			await onSend(text, references);
		} catch {
			query = text;
			attachments = sentAttachments;
		}
	}

	function openFilePicker() {
		fileInput?.click();
	}

	function handlePaste(event: ClipboardEvent) {
		const files = Array.from(event.clipboardData?.files ?? []);
		if (files.length === 0) return;
		event.preventDefault();
		void addFiles(files);
	}

	export function handleFiles(files: FileList | File[]) {
		void addFiles(Array.from(files));
	}

	function errorMessage(error: unknown, fallback: string) {
		return error instanceof Error ? error.message : fallback;
	}
</script>

<form
	data-component="send-message-form"
	class="w-full"
	onsubmit={(event) => event.preventDefault()}
	ondragover={(event) => {
		if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
	}}
	ondrop={(event) => {
		const files = Array.from(event.dataTransfer?.files ?? []);
		if (files.length === 0) return;
		event.preventDefault();
		void addFiles(files);
	}}
>
	<div class="relative flex w-full items-center">
		<div class="flex w-full flex-col rounded-lg bg-surface-50-950 ring ring-surface-300-700 transition-colors">
			{#if attachments.length > 0}
				<div class="flex flex-wrap gap-2 p-4">
					{#each attachments as attachment (attachment.file.reference)}
						<AttachmentPreviewItem
							attachment={attachment.file}
							url={attachment.url}
							loading={attachment.loading}
							onRemove={removeAttachment}
						/>
					{/each}
				</div>
			{/if}

			<ChatEditor
				value={query}
				placeholder="Message Heswe…"
				{disabled}
				autofocus
				bind:this={editor}
				onChange={(value) => query = value}
				onSubmit={() => void send()}
				getFileMentions={searchFiles}
				onPaste={handlePaste}
			/>

			<div class="flex items-center justify-between p-2 pt-0 text-sm">
				<div class="flex items-center gap-2">
					<ContextMenu
						open={attachmentMenuOpen}
						onOpenChange={(event) => (attachmentMenuOpen = event.open)}
						placement="top"
						maxWidth="280px"
					>
						{#snippet trigger(attributes)}
							<button
								{...attributes}
								type="button"
								class="flex size-9 items-center justify-center transition-colors"
								aria-label="Add attachments"
								disabled={disabled}
							>
								<Plus size={20} />
							</button>
						{/snippet}
						{#snippet content()}
							<div class="space-y-2">
							<button
								type="button"
								class="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-surface-300-700/30"
								onclick={openFilePicker}
							>
								<ImageIcon size={18} />
								<span>Upload photos & files</span>
							</button>
							<button
								type="button"
								class="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-surface-300-700/30"
								onclick={openWorkspaceFilePicker}
							>
								<FolderOpen size={18} />
								<span>Browse workspace files</span>
							</button>
							</div>
						{/snippet}
					</ContextMenu>

					<input
						type="file"
						multiple
						class="hidden"
						bind:this={fileInput}
						onchange={(event) => {
							const files = Array.from(event.currentTarget.files ?? []);
							void addFiles(files);
							event.currentTarget.value = '';
						}}
					/>
				</div>

				<button
					type="button"
					class="flex size-9 items-center justify-center transition-colors"
					class:opacity-50={!canSend}
					disabled={!canSend}
					aria-label="Send"
					onclick={() => void send()}
				>
					<Send size={20} />
				</button>
			</div>
		</div>
	</div>
</form>
