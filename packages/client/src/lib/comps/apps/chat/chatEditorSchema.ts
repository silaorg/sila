import {
  Schema,
  Fragment,
  type DOMOutputSpec,
  type Node as PMNode,
} from "prosemirror-model";

const nodes = {
  doc: {
    content: "inline*",
  },
  text: {
    group: "inline",
  },
  hard_break: {
    inline: true,
    group: "inline",
    selectable: false,
    parseDOM: [{ tag: "br" }],
    toDOM(): DOMOutputSpec {
      return ["br"] as DOMOutputSpec;
    },
  },
  mention: {
    group: "inline",
    inline: true,
    atom: true,
    selectable: false,
    attrs: {
      id: {},
      type: {},
      label: {},
    },
    toDOM(node: PMNode): DOMOutputSpec {
      return [
        "span",
        {
          class: "chat-file-mention",
          "data-file-id": node.attrs.id,
          "data-file-type": node.attrs.type,
        },
        `@${node.attrs.label}`,
      ] as DOMOutputSpec;
    },
    parseDOM: [
      {
        tag: "span.chat-file-mention",
        getAttrs(dom: Element) {
          if (!(dom instanceof HTMLElement)) return false;
          return {
            id: dom.dataset.fileId,
            type: dom.dataset.fileType,
            label: dom.textContent?.replace(/^@/, "") ?? "",
          };
        },
      },
    ],
  },
};

export const chatEditorSchema = new Schema({
  nodes,
  marks: {},
});

export function createDocFromText(text: string) {
  if (!text) return undefined;
  return chatEditorSchema.node(
    "doc",
    undefined,
    Fragment.from(chatEditorSchema.text(text))
  );
}
