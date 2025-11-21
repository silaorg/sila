import { MarkpageOptions } from "@markpage/svelte";
import type { Component } from "svelte";

import MarkdownCode from "./markdown-components/MarkdownCode.svelte";
import MarkdownCodeSpan from "./markdown-components/MarkdownCodeSpan.svelte";
import MarkdownTeX from "./markdown-components/MarkdownTeX.svelte";
import MarkdownTeXBlock from "./markdown-components/MarkdownTeXBlock.svelte";
import MarkdownLink from "./markdown-components/MarkdownLink.svelte";
import MarkdownImage from "./markdown-components/MarkdownImage.svelte";
import {
  createBlockLatexExtension,
  createInlineLatexExtension,
} from "./markdown-extensions/latexInMarkdown";

export const chatMarkdownOptions = new MarkpageOptions()
  .overrideBuiltinToken("code", MarkdownCode as Component)
  .overrideBuiltinToken("codespan", MarkdownCodeSpan as Component)
  // @NOTE: those are not built-in tokens; let's refactor the logic for defining custom tokensin Markpage 
  .overrideBuiltinToken("texInline", MarkdownTeX as Component)
  .overrideBuiltinToken("texBlock", MarkdownTeXBlock as Component)
  .overrideBuiltinToken("link", MarkdownLink as Component)
  .overrideBuiltinToken("image", MarkdownImage as Component)
  .extendMarkdown({
    extensions: [
      createInlineLatexExtension(MarkdownTeX),
      createBlockLatexExtension(MarkdownTeXBlock),
    ],
  });


