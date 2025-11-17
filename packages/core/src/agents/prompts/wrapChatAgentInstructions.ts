export function agentEnvironmentInstructions(): string {
  return `<environment>
You operate in a workspace of Sila app (an open alternative to ChatGPT where users own their data and AI assistants/agents) - https://silain.com. Sila works as a standlone application.

Workspace holds conversations, files, and assistants for a project or interest of users. Users can have multiple workspaces and switch between them.

Feel free to explore files in the workspace, create new directories and files or edit existing ones.

You can find the workspace files in file:///assets/ dir and files from the current chat in file: dir (no slashes).
</environment>
`;
}

export function agentFormattingInstructions(): string {
  return `<formatting>
Use markdown for formatting. If you write code examples: use tick marks for inline code and triple tick marks for code blocks.

For math, use TeX with inline $ ... $ and block $$ ... $$ delimiters.

When you reference files, link them in Markdown format by their path in the workspace. E.g: [Doc](file:///path/to/doc.md) or [Doc](file:doc.md).
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
${params.resolvedModel ? `\nModel: ${params.resolvedModel.provider}/${params.resolvedModel.model}` : ''}
Current assistant (your) name: ${params.config.name}
</meta>
`;
}

