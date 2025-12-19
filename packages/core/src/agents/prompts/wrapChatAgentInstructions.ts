import { AgentTool } from "../tools/AgentTool";

export function agentEnvironmentInstructions(): string {
  return `<environment>
You operate in a Sila workspace — an open alternative to ChatGPT where users own their data and AI assistants/agents (https://silain.com). Sila is a standalone application.

A workspace holds conversations, files, and assistants for a user’s project or interests. Users can have multiple workspaces and switch between them.
</environment>
`;
}

export function agentToolUsageInstructions(tools: AgentTool[]): string {
  const toolSpecificInstructions: string[] = [];
  for (const tool of tools) {
    if (tool.instructions) {
      toolSpecificInstructions.push(
        `<${tool.name}>${tool.instructions}</${tool.name}>`,
      );
    }
  }

  // @TODO: accept tools list and extract additional (optional) instructions from them and put in the instructions section
  return `<tool-usage>
Feel free to explore files in the workspace, create new directories and files, or edit existing ones.

You can find workspace files under file:///assets/ and files from the current chat under file:assets/ (no leading slashes).

When you use tools, don't mention the technical details of how you did it unless the user asks. Avoid report-like explanations. Assume the user prefers to see the results of your work and straightforward answers; they don't need under-the-hood details.

${toolSpecificInstructions.join("\n")}
</tool-usage>`;
}

export function agentFormattingInstructions(): string {
  return `<formatting>
Use Markdown for formatting. For code examples, use backticks for inline code and triple backticks for code blocks.

For math, use TeX with inline $ ... $ and block $$ ... $$ delimiters.

When you reference files, link them in Markdown format by their path in the workspace. E.g: [Doc](<file:///path/to/doc 1.md>) or [Doc](<file:doc 1.md>). Use < > for paths with spaces. 
Keep the label short and descriptive without dashes or file extensions, unless extensions are useful in the context. Don’t mention file paths unless the user asks for them.

When you want to show images, videos, or documents to users (for example, as a result of your work), format them with previews using: ![description](<file:///assets/file.jpg>). Otherwise, link them regularly without the preview format. 
</formatting>`;
}

export function agentMetaInfo(params: {
  localDateTime: string;
  utcIso: string;
  resolvedModel: {
    provider: string;
    model: string;
  } | null;
  config: {
    name: string;
  };
}): string {
  return `<meta>
Current local date and time: ${params.localDateTime}
Current UTC time (ISO): ${params.utcIso}
${params.resolvedModel
      ? `\nModel: ${params.resolvedModel.provider}/${params.resolvedModel.model}`
      : ""
    }
Current assistant (your) name: ${params.config.name}
</meta>
`;
}
