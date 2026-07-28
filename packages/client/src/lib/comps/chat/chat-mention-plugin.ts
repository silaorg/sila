import { Plugin, type EditorState } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { WorkspaceFile } from '../../api-client';

export type FileMention = WorkspaceFile & {
	url: string;
};

type MentionHandlers = {
	open: (payload: {
		view: EditorView;
		anchorPos: number;
		insertPos: number;
		query: string;
	}) => void;
	close: () => void;
	isOpen: () => boolean;
};

type MentionContext = {
	head: number;
	triggerPos: number;
	query: string;
};

const LOOKBACK_LIMIT = 80;

function getTextSlice(state: EditorState, from: number, to: number) {
	const start = Math.max(0, Math.min(from, state.doc.content.size));
	const end = Math.max(0, Math.min(to, state.doc.content.size));
	return end > start ? state.doc.textBetween(start, end, '\n', '\n') : '';
}

function isBoundaryChar(char: string) {
	return char === '' || /\s/.test(char);
}

function isValidMentionQuery(query: string) {
	if (!query) return true;
	if (query.includes('\n') || query.includes('\t') || query.includes('  ')) return false;
	const spaces = (query.match(/ /g) ?? []).length;
	return spaces <= 1 && !(spaces === 1 && query.replace(/ /g, '').length === 0);
}

function getMentionContext(state: EditorState): MentionContext | null {
	const head = state.selection.from;
	const start = Math.max(0, head - LOOKBACK_LIMIT);
	const chunk = state.doc.textBetween(start, head, '\n', '\n');
	const relativeTrigger = chunk.lastIndexOf('@');
	if (relativeTrigger === -1) return null;

	const triggerPos = start + relativeTrigger;
	if (!isBoundaryChar(getTextSlice(state, triggerPos - 1, triggerPos))) return null;
	const query = getTextSlice(state, triggerPos + 1, head);
	if (!isValidMentionQuery(query)) return null;
	return { head, triggerPos, query };
}

function schedule(callback: () => void) {
	if (typeof requestAnimationFrame === 'function') requestAnimationFrame(callback);
	else setTimeout(callback, 0);
}

export function createFileMentionPlugin(handlers: MentionHandlers) {
	let lastContextKey: string | null = null;

	function sync(view: EditorView) {
		const context = getMentionContext(view.state);
		if (!context) {
			if (handlers.isOpen()) handlers.close();
			lastContextKey = null;
			return;
		}
		const key = `${context.triggerPos}:${context.head}:${context.query}`;
		if (!handlers.isOpen() || key !== lastContextKey) {
			handlers.open({
				view,
				anchorPos: context.head,
				insertPos: context.head,
				query: context.query
			});
		}
		lastContextKey = key;
	}

	const deferSync = (view: EditorView) => schedule(() => sync(view));
	return new Plugin({
		props: {
			handleTextInput(view) {
				deferSync(view);
				return false;
			},
			handleKeyDown(view, event) {
				if (event.key === 'Escape' && handlers.isOpen()) {
					handlers.close();
					lastContextKey = null;
					return true;
				}
				deferSync(view);
				return false;
			},
			handleClick(view) {
				deferSync(view);
				return false;
			}
		},
		view() {
			return {
				update(view, previousState) {
					if (
						!previousState.doc.eq(view.state.doc)
						|| !previousState.selection.eq(view.state.selection)
					) deferSync(view);
				},
				destroy() {
					lastContextKey = null;
				}
			};
		}
	});
}

export function insertFileMention(view: EditorView, position: number, file: FileMention) {
	const { state } = view;
	const mention = state.schema.nodes.mention.create({
		reference: file.reference,
		label: file.name
	});
	const context = getMentionContext(state);
	const from = context?.triggerPos ?? Math.max(0, position - 1);
	const to = context?.head ?? position;
	let transaction = state.tr.replaceWith(from, to, mention);
	transaction = transaction.insert(from + mention.nodeSize, state.schema.text(' '));
	view.dispatch(transaction.scrollIntoView());
}
