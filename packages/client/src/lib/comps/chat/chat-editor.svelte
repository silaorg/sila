<script lang="ts">
	import { history, redo, undo } from 'prosemirror-history';
	import { keymap } from 'prosemirror-keymap';
	import { Fragment, Slice, type Node as PMNode } from 'prosemirror-model';
	import { EditorState, Plugin } from 'prosemirror-state';
	import { EditorView } from 'prosemirror-view';
	import { onDestroy, onMount } from 'svelte';
	import {
		chatEditorSchema,
		createDocFromText,
		serializeDocToMarkdown
	} from './chat-editor-schema';
	import {
		createFileMentionPlugin,
		insertFileMention,
		type FileMention
	} from './chat-mention-plugin';
	import FileMentionMenu from './file-mention-menu.svelte';

	let {
		value = '',
		placeholder = '',
		disabled = false,
		autofocus = false,
		onChange,
		onSubmit,
		onFocusChange,
		getFileMentions,
		onPaste
	}: {
		value?: string;
		placeholder?: string;
		disabled?: boolean;
		autofocus?: boolean;
		onChange?: (value: string) => void;
		onSubmit?: () => void;
		onFocusChange?: (focused: boolean) => void;
		getFileMentions?: (query: string) => Promise<FileMention[]> | FileMention[];
		onPaste?: (event: ClipboardEvent) => void;
	} = $props();

	let host: HTMLDivElement | null = $state(null);
	let view: EditorView | null = null;
	let plugins: Plugin[] = [];
	let mentionOpen = $state(false);
	let mentionCoords = $state({ x: 0, y: 0 });
	let mentionInsert: ((file: FileMention) => void) | null = null;
	let mentionFiles = $state<FileMention[]>([]);
	let selectedIndex = $state(0);
	let queryToken = 0;

	async function loadMentionFiles(query: string) {
		const token = ++queryToken;
		try {
			const result = await getFileMentions?.(query);
			if (token === queryToken) mentionFiles = result ?? [];
		} catch {
			if (token === queryToken) mentionFiles = [];
		}
	}

	function openMention(payload: {
		view: EditorView;
		anchorPos: number;
		insertPos: number;
		query: string;
	}) {
		const coords = payload.view.coordsAtPos(payload.anchorPos);
		mentionCoords = { x: coords.left, y: coords.bottom + 4 };
		mentionInsert = (file) => {
			insertFileMention(payload.view, payload.insertPos, file);
		};
		selectedIndex = 0;
		void loadMentionFiles(payload.query);
		mentionOpen = true;
	}

	function closeMention() {
		mentionOpen = false;
		mentionInsert = null;
	}

	function pickMention(file: FileMention, event?: MouseEvent) {
		event?.preventDefault();
		event?.stopPropagation();
		mentionInsert?.(file);
		closeMention();
		requestAnimationFrame(() => view?.focus());
	}

	export function insertFileMentionAtCursor(file: FileMention) {
		if (!view) return;
		const mention = view.state.schema.nodes.mention.create({
			reference: file.reference,
			label: file.name
		});
		let transaction = view.state.tr.replaceSelectionWith(mention);
		transaction = transaction.insert(transaction.selection.from, view.state.schema.text(' '));
		view.dispatch(transaction.scrollIntoView());
		requestAnimationFrame(() => view?.focus());
	}

	function syncExternalValue(nextValue: string) {
		if (!view || serializeDocToMarkdown(view.state.doc) === nextValue) return;
		const doc = createDocFromText(nextValue);
		view.updateState(EditorState.create({
			schema: chatEditorSchema,
			plugins,
			...(doc ? { doc } : {})
		}));
	}

	function initializeEditor() {
		if (!host) return;
		const mentionPlugin = createFileMentionPlugin({
			open: openMention,
			close: closeMention,
			isOpen: () => mentionOpen
		});
		const pastePlugin = new Plugin({
			props: {
				handlePaste(editorView, event) {
					onPaste?.(event);
					if (event.defaultPrevented) return true;
					const text = event.clipboardData?.getData('text/plain') ?? '';
					if (!text.includes('\n')) return false;
					event.preventDefault();
					const pastedDoc = createDocFromText(text);
					if (!pastedDoc) return true;
					editorView.dispatch(
						editorView.state.tr.replaceSelection(new Slice(pastedDoc.content, 0, 0))
					);
					return true;
				},
				transformPasted(slice) {
					const nodes: PMNode[] = [];
					let transformed = false;
					slice.content.forEach((node) => {
						if (node.type.name !== 'text' || !node.text?.includes('\n')) {
							nodes.push(node);
							return;
						}
						transformed = true;
						const lines = node.text.split('\n');
						lines.forEach((line, index) => {
							if (line) nodes.push(chatEditorSchema.text(line));
							if (index < lines.length - 1) {
								nodes.push(chatEditorSchema.nodes.hard_break.create());
							}
						});
					});
					return transformed
						? new Slice(Fragment.from(nodes), slice.openStart, slice.openEnd)
						: slice;
				}
			}
		});
		const submitPlugin = new Plugin({
			props: {
				handleKeyDown(editorView, event) {
					if (mentionOpen && mentionFiles.length > 0) {
						if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
							event.preventDefault();
							const offset = event.key === 'ArrowDown' ? 1 : -1;
							selectedIndex = (
								selectedIndex + offset + mentionFiles.length
							) % mentionFiles.length;
							return true;
						}
						if (event.key === 'Enter' && !event.shiftKey) {
							event.preventDefault();
							pickMention(mentionFiles[selectedIndex] ?? mentionFiles[0]);
							return true;
						}
					}
					if (event.key === 'Enter' && event.shiftKey) {
						event.preventDefault();
						editorView.dispatch(
							editorView.state.tr.replaceSelectionWith(
								chatEditorSchema.nodes.hard_break.create()
							)
						);
						return true;
					}
					if (event.key === 'Enter' && !event.shiftKey) {
						if (disabled) return false;
						event.preventDefault();
						onSubmit?.();
						return true;
					}
					return false;
				}
			}
		});

		plugins = [
			history({ newGroupDelay: 0 }),
			keymap({ 'Mod-z': undo, 'Mod-y': redo, 'Shift-Mod-z': redo }),
			mentionPlugin,
			pastePlugin,
			submitPlugin
		];
		const doc = createDocFromText(value);
		view = new EditorView(host, {
			state: EditorState.create({
				schema: chatEditorSchema,
				plugins,
				...(doc ? { doc } : {})
			}),
			dispatchTransaction(transaction) {
				const nextState = view!.state.apply(transaction);
				view!.updateState(nextState);
				const markdown = serializeDocToMarkdown(nextState.doc);
				if (markdown !== value) onChange?.(markdown);
			},
			editable: () => !disabled,
			handleDOMEvents: {
				focus() {
					onFocusChange?.(true);
					return false;
				},
				blur() {
					queueMicrotask(() => {
						closeMention();
						onFocusChange?.(false);
					});
					return false;
				}
			}
		});
		if (autofocus) requestAnimationFrame(() => view?.focus());
	}

	$effect(() => syncExternalValue(value));
	onMount(initializeEditor);
	onDestroy(() => view?.destroy());
</script>

<div class="chat-editor-area relative">
	{#if value.trim().length === 0}
		<div class="pointer-events-none absolute left-2 top-2 text-sm opacity-50">
			{placeholder}
		</div>
	{/if}
	<div class="chat-editor-host min-h-[48px] px-2 py-2" bind:this={host}></div>
	{#if mentionOpen}
		<FileMentionMenu
			files={mentionFiles}
			{selectedIndex}
			coords={mentionCoords}
			onFilePick={pickMention}
			onClose={closeMention}
		/>
	{/if}
</div>

<style>
	.chat-editor-host :global(.ProseMirror) {
		outline: none;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.chat-editor-host :global(.ProseMirror p) {
		margin: 0;
	}
</style>
