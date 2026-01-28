export interface SearchReplaceBlock {
  search: string;
  replace: string;
}

export interface FilePatch {
  path: string;
  blocks: SearchReplaceBlock[];
}

export function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("```") || trimmed === "```") {
    return trimmed;
  }

  const withoutFirstLine = trimmed.replace(/^```[^\n]*\n/, "");
  const closingIndex = withoutFirstLine.lastIndexOf("\n```");
  if (closingIndex !== -1) {
    return withoutFirstLine.slice(0, closingIndex).trim();
  }
  return withoutFirstLine.trim();
}

export function parseSearchReplaceBlocks(patch: string): SearchReplaceBlock[] {
  const blocks: SearchReplaceBlock[] = [];
  const regex =
    /<<<<<<< SEARCH\r?\n([\s\S]*?)\r?\n?=======\r?\n([\s\S]*?)\r?\n>>>>>>> REPLACE/g;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(patch)) !== null) {
    blocks.push({ search: match[1], replace: match[2] });
  }

  if (blocks.length === 0) {
    throw new Error("No SEARCH/REPLACE blocks found in patch");
  }

  return blocks;
}

export function parseFilePatches(rawPatch: string): FilePatch[] {
  const cleaned = stripCodeFence(rawPatch);
  const fileBlockRegex =
    /^([^\n`][^\n]*)\n\s*(?:```[^\n]*\n)?(<<<<<<< SEARCH[\s\S]*?>>>>>>> REPLACE)(?:\n```)?/gm;

  const grouped = new Map<string, SearchReplaceBlock[]>();
  let match: RegExpExecArray | null;

  while ((match = fileBlockRegex.exec(cleaned)) !== null) {
    const path = match[1].trim();
    const blockText = match[2];

    if (!path) {
      continue;
    }

    const blocks = parseSearchReplaceBlocks(blockText);
    const existing = grouped.get(path) ?? [];
    grouped.set(path, [...existing, ...blocks]);
  }

  if (grouped.size === 0) {
    throw new Error("No file paths found in patch");
  }

  return Array.from(grouped.entries()).map(([path, blocks]) => ({ path, blocks }));
}

export function extractPatchPaths(rawPatch: string): string[] {
  if (typeof rawPatch !== "string" || !rawPatch.trim()) return [];
  try {
    return parseFilePatches(rawPatch).map((entry) => entry.path);
  } catch {
    return [];
  }
}
