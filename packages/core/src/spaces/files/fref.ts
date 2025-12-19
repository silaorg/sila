export interface ParsedFrefUri {
  vertexId: string;
  treeId?: string;
}

export function parseFrefUri(uri: string): ParsedFrefUri | null {
  if (!uri || typeof uri !== "string") return null;
  if (!uri.startsWith("fref:")) return null;

  const rest = uri.slice("fref:".length).trim();
  if (!rest) return null;

  const at = rest.indexOf("@");
  if (at === -1) {
    return { vertexId: rest };
  }

  const vertexId = rest.slice(0, at).trim();
  const treeId = rest.slice(at + 1).trim();
  if (!vertexId) return null;
  if (!treeId) return { vertexId };
  return { vertexId, treeId };
}

export function formatFrefUri(vertexId: string, treeId?: string): string {
  if (!treeId) return `fref:${vertexId}`;
  return `fref:${vertexId}@${treeId}`;
}

