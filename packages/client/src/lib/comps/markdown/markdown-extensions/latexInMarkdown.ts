import type { MarkdownExtension } from "@markpage/svelte";

const inlineRule =
  /^(\${1,2})(?!\$)((?:\\.|[^\\\n])*?(?:\\.|[^\\\n\$]))\1(?=[\s?!\.,:？！。，：]|$)/;
const blockRule = /^(\${2})(?:\n|)((?:\\[^]|[^\\])+?)(?:\n|)\$\$(?:\n|$)/;

export const createInlineLatexExtension = (component: any): MarkdownExtension => ({
  name: "texInline",
  level: "inline",
  component,
  start(src: string): number | undefined {
    let index;
    let indexSrc = src;

    while (indexSrc) {
      index = indexSrc.indexOf("$");
      if (index === -1) {
        return undefined;
      }

      if (index === 0 || indexSrc.charAt(index - 1) === " ") {
        const possibleKatex = indexSrc.substring(index);
        if (possibleKatex.match(inlineRule)) {
          return index;
        }
      }

      indexSrc = indexSrc.substring(index + 1).replace(/^\$+/, "");
    }
  },
  tokenizer(src: string) {
    const match = src.match(inlineRule);
    if (match) {
      return {
        type: "texInline",
        raw: match[0],
        text: match[2].trim(),
        displayMode: match[1].length === 2,
      };
    }
  },
});

export const createBlockLatexExtension = (component: any): MarkdownExtension => ({
  name: "texBlock",
  level: "block",
  component,
  start(src: string): number | undefined {
    let index;
    let indexSrc = src;

    while (indexSrc) {
      index = indexSrc.indexOf("$$");
      if (index === -1) {
        return undefined;
      }
      
      if (index === 0 || indexSrc.charAt(index - 1) === "\n") {
        const possibleKatex = indexSrc.substring(index);
        if (possibleKatex.match(blockRule)) {
          return index;
        }
      }

      indexSrc = indexSrc.substring(index + 2).replace(/^\$+/, "");
    }
  },
  tokenizer(src: string) {
    const match = src.match(blockRule);
    if (match) {
      return {
        type: "texBlock",
        raw: match[0],
        text: match[2].trim(),
        displayMode: match[1].length === 2,
      };
    }
  },
});