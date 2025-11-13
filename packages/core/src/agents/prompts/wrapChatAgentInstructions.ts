export function formattingInstructions(): string {
  return `<formatting>
Use markdown for formatting. If you write code examples: use tick marks for inline code and triple tick marks for code blocks.

For math, use TeX with inline $ ... $ and block $$ ... $$ delimiters.
</formatting>`;
}

export function chatAgentMetaInstructions(params: {
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
Environment: a workspace in Sila app (open alternative to ChatGPT where users own their data) - https://silain.com
</meta>
`;
}

