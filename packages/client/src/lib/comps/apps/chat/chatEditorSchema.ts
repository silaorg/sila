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
      path: {},
      label: {},
    },
    toDOM(node: PMNode): DOMOutputSpec {
      return [
        "span",
        {
          class: "chat-file-mention",
          "data-file-path": node.attrs.path,
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
            path: dom.dataset.filePath,
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

// Serialize a ProseMirror document to markdown
// Converts mention nodes to markdown links like [@label](file:...)
export function serializeDocToMarkdown(doc: PMNode): string {
  let markdown = "";
  
  doc.forEach((node) => {
    if (node.type.name === "mention") {
      // Convert mention to markdown link using the path directly
      const label = node.attrs.label || "";
      const path = node.attrs.path || "";
      markdown += `[@${label}](${path})`;
    } else if (node.type.name === "text") {
      // Escape markdown special characters in text
      markdown += node.text;
    } else if (node.type.name === "hard_break") {
      markdown += "\n";
    } else {
      // For other nodes, get their text content
      markdown += node.textContent;
    }
  });
  
  return markdown;
}

// Create a ProseMirror document from text
// This is the simple default way - just create a doc with text nodes
export function createDocFromText(text: string) {
  if (!text) return undefined;
  return chatEditorSchema.node(
    "doc",
    undefined,
    Fragment.from(chatEditorSchema.text(text))
  );
}
