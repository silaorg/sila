import { MarkpageOptions } from "@markpage/svelte";
import type { Component } from "svelte";

import MarkdownCode from "./markdown-components/MarkdownCode.svelte";
import MarkdownCodeSpan from "./markdown-components/MarkdownCodeSpan.svelte";
import MarkdownTeX from "./markdown-components/MarkdownTeX.svelte";
import MarkdownTeXBlock from "./markdown-components/MarkdownTeXBlock.svelte";
import {
  createBlockLatexExtension,
  createInlineLatexExtension,
} from "./markdown-extensions/latexInMarkdown";

export const chatMarkdownOptions = new MarkpageOptions()
  .overrideBuiltinToken("code", MarkdownCode as Component)
  .overrideBuiltinToken("codespan", MarkdownCodeSpan as Component)
  .overrideBuiltinToken("texInline", MarkdownTeX as Component)
  .overrideBuiltinToken("texBlock", MarkdownTeXBlock as Component)
  .extendMarkdown({
    extensions: [
      createInlineLatexExtension(MarkdownTeX),
      createBlockLatexExtension(MarkdownTeXBlock),
    ],
  });


