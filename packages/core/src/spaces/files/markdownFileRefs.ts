import type { Vertex } from "reptree";
import type { Space } from "../Space";
import type { FileResolver } from "./FileResolver";
import { marked } from "marked";
import { formatFrefUri, parseFrefUri } from "./fref";

type LinkKind = "link" | "image";

interface TokenTarget {
  kind: LinkKind;
  href: string;
}

export interface TransformPathsToFileReferencesCtx {
  /** Space id (space tree root id). Used when rewriting workspace `file:///...` links. */
  spaceId: string;
  fileResolver: FileResolver;
  /** For chat-scoped `file:...` links, pass the chat's assets root vertex. */
  relativeRootVertex?: Vertex;
  /** For chat-scoped `file:...` links, pass the chat app tree id. */
  relativeTreeId?: string;
}

export interface TransformFileReferencesToPathsCtx {
  space: Space;
  fileResolver: FileResolver;
  /** Ordered list of tree ids to search when encountering `fref:vertex` with no `@tree`. */
  candidateTreeIds?: string[];
}

const extractTokenTargets = (markdown: string): TokenTarget[] => {
  const targets: TokenTarget[] = [];
  const tokens = marked.lexer(markdown);
  marked.walkTokens(tokens as any, (t: any) => {
    if (!t) return;
    if (t.type === "link" && typeof t.href === "string") {
      targets.push({ kind: "link", href: t.href });
    } else if (t.type === "image" && typeof t.href === "string") {
      targets.push({ kind: "image", href: t.href });
    }
  });
  return targets;
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
  tokenTargets: TokenTarget[],
  replacer: (href: string, kind: LinkKind, tokenHref: string) => Promise<string | null>,
): Promise<{ markdown: string; changed: boolean }> => {
  if (!markdown) return { markdown, changed: false };
  if (tokenTargets.length === 0) return { markdown, changed: false };

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

    // Fenced code blocks.
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

    // Inline code spans.
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
    let kind: LinkKind | null = null;
    let bracketOpen = -1;
    if (ch === "!" && s[i + 1] === "[") {
      kind = "image";
      bracketOpen = i + 1;
    } else if (ch === "[") {
      kind = "link";
      bracketOpen = i;
    }

    if (kind && bracketOpen >= 0) {
      const bracketClose = readBracketed(s, bracketOpen);
      if (bracketClose !== null) {
        // Skip whitespace between ']' and '('
        let k = bracketClose + 1;
        while (k < s.length && (s[k] === " " || s[k] === "\t")) k++;
        if (s[k] === "(") {
          const parsed = parseInlineLinkDestination(s, k);
          if (parsed && tokenIdx < tokenTargets.length) {
            const tokenHref = tokenTargets[tokenIdx]!.href;
            tokenIdx++;

            const href = s.slice(parsed.destStart, parsed.destEnd);
            const replacement = await replacer(href, kind, tokenHref);
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
  const tokenTargets = extractTokenTargets(markdown);
  const { markdown: rewritten } = await rewriteInlineLinkTargets(
    markdown,
    tokenTargets,
    async (href) => {
      if (!href.startsWith("file:")) return null;
      const isWorkspace = href.startsWith("file:///");
      const treeId = isWorkspace ? ctx.spaceId : (ctx.relativeTreeId ?? ctx.spaceId);
      try {
        const vertex = ctx.fileResolver.pathToVertex(
          href,
          isWorkspace ? undefined : ctx.relativeRootVertex,
        );
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
  const tokenTargets = extractTokenTargets(markdown);
  let didHealRefs = false;

  const spaceId = ctx.space.getId();
  const candidates = ctx.candidateTreeIds?.length
    ? ctx.candidateTreeIds
    : [spaceId];

  const { markdown: rewritten } = await rewriteInlineLinkTargets(
    markdown,
    tokenTargets,
    async (href) => {
      if (!href.startsWith("fref:")) return null;
      const parsed = parseFrefUri(href);
      if (!parsed) return null;

      const { vertexId, treeId } = parsed;

      const tryResolveInTree = async (tid: string): Promise<Vertex | null> => {
        if (tid === spaceId) {
          return ctx.space.getVertex(vertexId) ?? null;
        }
        const appTree = await ctx.space.loadAppTree(tid);
        if (!appTree) return null;
        return (appTree.tree.getVertex(vertexId) as Vertex | undefined) ?? null;
      };

      let vertex: Vertex | null = null;
      if (treeId) {
        vertex = await tryResolveInTree(treeId);
      } else {
        didHealRefs = true;
        for (const tid of candidates) {
          vertex = await tryResolveInTree(tid);
          if (vertex) break;
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

