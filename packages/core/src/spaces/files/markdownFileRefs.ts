import type { Vertex } from "reptree";
import type { Space } from "../Space";
import type { FileResolver } from "./FileResolver";
import { marked } from "marked";
import { formatFrefUri, parseFrefUri } from "./fref";

export interface TransformPathsToFileReferencesCtx {
  fileResolver: FileResolver;
  /** For chat-scoped `file:...` links, pass the chat's assets root vertex. */
  relativeRootVertex?: Vertex;
}

export interface TransformFileReferencesToPathsCtx {
  space: Space;
  fileResolver: FileResolver;
  /** Ordered list of tree ids to search when encountering `fref:vertex` with no `@tree`. */
  candidateTreeIds?: string[];
}

/**
 * Extract link/image targets using Marked (tokenizer), but rewrite the ORIGINAL markdown string.
 *
 * Why: we want to avoid regex-rewriting code blocks/inline code, and we also want to preserve the
 * user’s original formatting as much as possible (we only rewrite the link destination spans).
 *
 * V1 limitation: we only rewrite inline link/image syntax `[text](target "title")` / `![alt](target)`.
 * We intentionally ignore reference-style links in v1.
 */
const extractTokenHrefs = (markdown: string): string[] => {
  const hrefs: string[] = [];
  const tokens = marked.lexer(markdown);
  marked.walkTokens(tokens as any, (t: any) => {
    if (!t) return;
    if (t.type === "link" && typeof t.href === "string") {
      hrefs.push(t.href);
    } else if (t.type === "image" && typeof t.href === "string") {
      hrefs.push(t.href);
    }
  });
  return hrefs;
};

const isWhitespace = (ch: string): boolean => ch === " " || ch === "\t" || ch === "\n" || ch === "\r";

const isFenceStart = (s: string, i: number): { ch: "`" | "~"; len: number } | null => {
  const ch = s[i];
  if (ch !== "`" && ch !== "~") return null;
  let j = i;
  while (j < s.length && s[j] === ch) j++;
  const len = j - i;
  if (len >= 3) return { ch, len };
  return null;
};

const readBracketed = (s: string, openIdx: number): number | null => {
  // openIdx points at '['
  let i = openIdx + 1;
  let depth = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === "[") {
      depth++;
      i++;
      continue;
    }
    if (ch === "]") {
      if (depth === 0) return i;
      depth--;
      i++;
      continue;
    }
    i++;
  }
  return null;
};

const parseInlineLinkDestination = (
  s: string,
  parenOpenIdx: number,
): {
  destStart: number;
  destEnd: number;
  parenCloseIdx: number;
} | null => {
  // parenOpenIdx points at '('
  let i = parenOpenIdx + 1;
  while (i < s.length && isWhitespace(s[i]!)) i++;
  if (i >= s.length) return null;

  let destStart = i;
  let destEnd = i;

  if (s[i] === "<") {
    // Destination enclosed in <...>
    destStart = i + 1;
    i = destStart;
    while (i < s.length) {
      const ch = s[i]!;
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === ">") {
        destEnd = i;
        i++; // after '>'
        break;
      }
      i++;
    }
    if (destEnd < destStart) return null;
  } else {
    // Bare destination. Stop at whitespace or ')' (respecting balanced parens).
    destStart = i;
    let depth = 0;
    while (i < s.length) {
      const ch = s[i]!;
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === "(") {
        depth++;
        i++;
        continue;
      }
      if (ch === ")") {
        if (depth === 0) break;
        depth--;
        i++;
        continue;
      }
      if (isWhitespace(ch) && depth === 0) break;
      i++;
    }
    destEnd = i;
  }

  // Now skip optional title and find the closing ')'
  while (i < s.length && isWhitespace(s[i]!)) i++;
  if (i >= s.length) return null;

  // If we're already at ')', no title.
  if (s[i] === ")") {
    return { destStart, destEnd, parenCloseIdx: i };
  }

  const quote = s[i]!;
  if (quote === `"` || quote === `'`) {
    i++;
    while (i < s.length) {
      const ch = s[i]!;
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === quote) {
        i++;
        break;
      }
      i++;
    }
    while (i < s.length && isWhitespace(s[i]!)) i++;
    if (s[i] !== ")") return null;
    return { destStart, destEnd, parenCloseIdx: i };
  }

  if (quote === "(") {
    // Title in parentheses.
    i++;
    let depth = 0;
    while (i < s.length) {
      const ch = s[i]!;
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === "(") {
        depth++;
        i++;
        continue;
      }
      if (ch === ")") {
        if (depth === 0) {
          i++; // consume ')'
          break;
        }
        depth--;
        i++;
        continue;
      }
      i++;
    }
    while (i < s.length && isWhitespace(s[i]!)) i++;
    if (s[i] !== ")") return null;
    return { destStart, destEnd, parenCloseIdx: i };
  }

  // Unknown title format; bail.
  return null;
};

const rewriteInlineLinkTargets = async (
  markdown: string,
  tokenHrefs: string[],
  replacer: (href: string) => Promise<string | null>,
): Promise<{ markdown: string; changed: boolean }> => {
  if (!markdown) return { markdown, changed: false };
  if (tokenHrefs.length === 0) return { markdown, changed: false };

  const s = markdown;
  const out: string[] = [];
  let changed = false;

  let lastCopy = 0;
  let i = 0;

  let inFence: { ch: "`" | "~"; len: number } | null = null;
  let atLineStart = true;
  let inlineTickLen = 0; // 0 = not in inline code

  let tokenIdx = 0;

  while (i < s.length) {
    const ch = s[i]!;

    // Track line start.
    if (ch === "\n") {
      atLineStart = true;
      i++;
      continue;
    }

    // Fenced code blocks: never rewrite anything inside.
    if (atLineStart) {
      const fence = isFenceStart(s, i);
      if (fence) {
        if (!inFence) {
          inFence = fence;
        } else if (inFence.ch === fence.ch && fence.len >= inFence.len) {
          inFence = null;
        }
        // Move to end of line; keep content unchanged.
        while (i < s.length && s[i] !== "\n") i++;
        continue;
      }
    }
    atLineStart = false;

    if (inFence) {
      i++;
      continue;
    }

    // Inline code spans: never rewrite anything inside.
    if (ch === "`") {
      let j = i;
      while (j < s.length && s[j] === "`") j++;
      const run = j - i;
      if (inlineTickLen === 0) {
        inlineTickLen = run;
      } else if (run === inlineTickLen) {
        inlineTickLen = 0;
      }
      i = j;
      continue;
    }
    if (inlineTickLen !== 0) {
      i++;
      continue;
    }

    // Inline links/images: [text](dest ...) or ![alt](dest ...)
    let bracketOpen = -1;
    if (ch === "!" && s[i + 1] === "[") {
      bracketOpen = i + 1;
    } else if (ch === "[") {
      bracketOpen = i;
    }

    if (bracketOpen >= 0) {
      const bracketClose = readBracketed(s, bracketOpen);
      if (bracketClose !== null) {
        // Skip whitespace between ']' and '('
        let k = bracketClose + 1;
        while (k < s.length && (s[k] === " " || s[k] === "\t")) k++;
        if (s[k] === "(") {
          const parsed = parseInlineLinkDestination(s, k);
          if (parsed && tokenIdx < tokenHrefs.length) {
            // Keep token stream alignment (Marked's lexer output).
            void tokenHrefs[tokenIdx];
            tokenIdx++;

            const href = s.slice(parsed.destStart, parsed.destEnd);
            const replacement = await replacer(href);
            if (replacement && replacement !== href) {
              out.push(s.slice(lastCopy, parsed.destStart));
              out.push(replacement);
              lastCopy = parsed.destEnd;
              changed = true;
            }

            // Continue scanning after ')'
            i = parsed.parenCloseIdx + 1;
            continue;
          }
        }
      }
    }

    i++;
  }

  if (!changed) return { markdown, changed: false };
  out.push(s.slice(lastCopy));
  return { markdown: out.join(""), changed: true };
};

export async function transformPathsToFileReferences(
  markdown: string,
  ctx: TransformPathsToFileReferencesCtx,
): Promise<string> {
  // Save-time transform: store stable fref URIs instead of path-based file: links.
  const tokenHrefs = extractTokenHrefs(markdown);
  const { markdown: rewritten } = await rewriteInlineLinkTargets(
    markdown,
    tokenHrefs,
    async (href) => {
      if (!href.startsWith("file:")) return null;
      try {
        // Resolve file: link to a vertex, then store as `fref:{vertexId}@{treeId}`.
        const vertex = ctx.fileResolver.pathToVertex(
          href,
          href.startsWith("file:///") ? undefined : ctx.relativeRootVertex,
        );
        const treeId = vertex.tree.root?.id;
        if (!treeId) return null;
        return formatFrefUri(vertex.id, treeId);
      } catch {
        return null;
      }
    },
  );
  return rewritten;
}

export async function transformFileReferencesToPaths(
  markdown: string,
  ctx: TransformFileReferencesToPathsCtx,
): Promise<{ markdown: string; didHealRefs: boolean }> {
  // Render/AI-time transform: convert stable frefs back into the current file: path.
  const tokenHrefs = extractTokenHrefs(markdown);
  let didHealRefs = false;

  const spaceId = ctx.space.getId();
  const candidates = ctx.candidateTreeIds?.length
    ? ctx.candidateTreeIds
    : [spaceId];

  const isUnderWorkspaceAssets = (vertex: Vertex | null): boolean => {
    if (!vertex) return false;
    try {
      const assetsRoot = ctx.space.getVertexByPath("assets");
      if (!assetsRoot) return false;
      let cur: Vertex | undefined | null = vertex;
      while (cur) {
        if (cur.id === assetsRoot.id) return true;
        cur = cur.parent as Vertex | undefined | null;
      }
      return false;
    } catch {
      return false;
    }
  };

  const { markdown: rewritten } = await rewriteInlineLinkTargets(
    markdown,
    tokenHrefs,
    async (href) => {
      if (!href.startsWith("fref:")) return null;
      const parsed = parseFrefUri(href);
      if (!parsed) return null;

      const { vertexId, treeId } = parsed;

      const tryResolveInTree = async (tid: string): Promise<Vertex | null> => {
        if (tid === spaceId) {
          const vertex = ctx.space.getVertex(vertexId) ?? null;
          // Only accept workspace references that live under /assets.
          // This keeps the fallback deterministic and avoids resolving to non-file vertices elsewhere.
          return isUnderWorkspaceAssets(vertex) ? vertex : null;
        }
        const appTree = await ctx.space.loadAppTree(tid);
        if (!appTree) return null;
        return (appTree.tree.getVertex(vertexId) as Vertex | undefined) ?? null;
      };

      let vertex: Vertex | null = null;
      if (treeId) {
        vertex = await tryResolveInTree(treeId);
        // If the ref points to a tree that no longer has the vertex, fall back to workspace assets.
        if (!vertex) {
          vertex = await tryResolveInTree(spaceId);
          // @TODO: if not found in workspace assets, later we can also search in a trashbin.
        }
      } else {
        didHealRefs = true;
        for (const tid of candidates) {
          vertex = await tryResolveInTree(tid);
          if (vertex) break;
        }
        // If tree id is missing (or candidates didn't find it), fall back to workspace assets.
        if (!vertex) {
          vertex = await tryResolveInTree(spaceId);
          // @TODO: if not found in workspace assets, later we can also search in a trashbin.
        }
      }

      if (!vertex) return null;
      try {
        return ctx.fileResolver.vertexToPath(vertex);
      } catch {
        return null;
      }
    },
  );

  return { markdown: rewritten, didHealRefs };
}

