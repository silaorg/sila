import { Fragment, Schema, type DOMOutputSpec, type Node as PMNode } from 'prosemirror-model';

const nodes = {
	doc: { content: 'inline*' },
	text: { group: 'inline' },
	hard_break: {
		inline: true,
		group: 'inline',
		selectable: false,
		parseDOM: [{ tag: 'br' }],
		toDOM: () => ['br'] as DOMOutputSpec
	},
	mention: {
		group: 'inline',
		inline: true,
		atom: true,
		selectable: false,
		attrs: { reference: {}, label: {} },
		toDOM(node: PMNode): DOMOutputSpec {
			return [
				'span',
				{
					class: 'chat-file-mention anchor',
					'data-file-reference': String(node.attrs.reference ?? '')
				},
				String(node.attrs.label ?? '')
			];
		},
		parseDOM: [{
			tag: 'span.chat-file-mention',
			getAttrs(dom: Element) {
				if (!(dom instanceof HTMLElement)) return false;
				return {
					reference: dom.dataset.fileReference,
					label: dom.textContent ?? ''
				};
			}
		}]
	}
};

export const chatEditorSchema = new Schema({ nodes, marks: {} });

export function serializeDocToMarkdown(doc: PMNode) {
	let markdown = '';
	doc.forEach((node) => {
		if (node.type.name === 'mention') {
			markdown += `[${node.attrs.label ?? ''}](<${node.attrs.reference ?? ''}>)`;
		} else if (node.type.name === 'text') {
			markdown += node.text ?? '';
		} else if (node.type.name === 'hard_break') {
			markdown += '\n';
		} else {
			markdown += node.textContent;
		}
	});
	return markdown;
}

export function createDocFromText(text: string) {
	if (!text) return undefined;
	const parts: PMNode[] = [];
	const tokenPattern = /\[([^\]]+)\]\(<((?:workspace|thread):[^>]+)>\)|\n/g;
	let offset = 0;

	for (const match of text.matchAll(tokenPattern)) {
		if (match.index > offset) parts.push(chatEditorSchema.text(text.slice(offset, match.index)));
		if (match[1] && match[2]) {
			parts.push(chatEditorSchema.nodes.mention.create({
				label: match[1],
				reference: match[2]
			}));
		} else {
			parts.push(chatEditorSchema.nodes.hard_break.create());
		}
		offset = match.index + match[0].length;
	}
	if (offset < text.length) parts.push(chatEditorSchema.text(text.slice(offset)));
	return chatEditorSchema.node('doc', undefined, Fragment.from(parts));
}
