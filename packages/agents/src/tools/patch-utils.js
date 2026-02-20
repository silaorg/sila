export function stripCodeFence(raw) {
  const trimmed = String(raw || "").trim();
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

export function parseSearchReplaceBlocks(patch) {
  const blocks = [];
  const regex =
    /<<<<<<< SEARCH\r?\n([\s\S]*?)\r?\n?=======\r?\n([\s\S]*?)\r?\n>>>>>>> REPLACE/g;

  let match;
  while ((match = regex.exec(patch)) !== null) {
    blocks.push({ search: match[1], replace: match[2] });
  }

  if (blocks.length === 0) {
    throw new Error("No SEARCH/REPLACE blocks found in patch");
  }

  return blocks;
}

export function parseFilePatches(rawPatch) {
  const cleaned = stripCodeFence(rawPatch);
  const fileBlockRegex =
    /^([^\n`][^\n]*)\n\s*(?:```[^\n]*\n)?(<<<<<<< SEARCH[\s\S]*?>>>>>>> REPLACE)(?:\n```)?/gm;

  const grouped = new Map();
  let match;

  while ((match = fileBlockRegex.exec(cleaned)) !== null) {
    const filePath = match[1].trim();
    const blockText = match[2];

    if (!filePath) continue;

    const blocks = parseSearchReplaceBlocks(blockText);
    const existing = grouped.get(filePath) ?? [];
    grouped.set(filePath, [...existing, ...blocks]);
  }

  if (grouped.size === 0) {
    throw new Error("No file paths found in patch. Format must be: path + SEARCH/REPLACE blocks.");
  }

  return Array.from(grouped.entries()).map(([filePath, blocks]) => ({ path: filePath, blocks }));
}
