import { ChatAppData, type Space } from "@sila/core";

export type SearchThreadEntry = {
  threadId: string;
  title: string;
  messages: string[];
  updatedAt?: number;
};

export type SearchResult = {
  threadId: string;
  title: string;
  snippet: string;
  updatedAt?: number;
  score: number;
};

export async function buildChatSearchEntries(space: Space): Promise<SearchThreadEntry[]> {
  const appTreeIds = space.getAppTreeIds();
  const entries: SearchThreadEntry[] = [];

  for (const appTreeId of appTreeIds) {
    let appTree = space.getAppTree(appTreeId);
    if (!appTree) {
      try {
        appTree = await space.loadAppTree(appTreeId);
      } catch {
        continue;
      }
    }
    if (!appTree) continue;

    const appId = appTree.getAppId();
    if (appId === "files") continue;

    const chatData = new ChatAppData(space, appTree);
    const spaceVertex = space.getVertexReferencingAppTree(appTreeId);
    const title = chatData.title ?? spaceVertex?.name ?? "New chat";
    const messages = chatData.messageVertices
      .map((vertex) => vertex.getProperty("text"))
      .filter((text): text is string => typeof text === "string" && text.trim().length > 0);
    const updatedAt = appTree.tree.root?.updatedAt?.getTime();

    entries.push({
      threadId: appTreeId,
      title,
      messages,
      updatedAt,
    });
  }

  return entries;
}

export function searchChatThreads(entries: SearchThreadEntry[], query: string): SearchResult[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const results: SearchResult[] = [];

  for (const entry of entries) {
    const title = entry.title ?? "New chat";
    const titleLower = title.toLowerCase();
    const combined = `${title} ${entry.messages.join(" ")}`.toLowerCase();
    const matchesAll = tokens.every((token) => combined.includes(token));

    if (!matchesAll) continue;

    let score = 0;
    for (const token of tokens) {
      if (titleLower.includes(token)) {
        score += 2;
      }
      score += countOccurrences(combined, token);
    }

    const matchingMessage = entry.messages.find((message) =>
      tokens.some((token) => message.toLowerCase().includes(token))
    );
    const snippetSource = matchingMessage ?? title;

    results.push({
      threadId: entry.threadId,
      title,
      snippet: truncate(snippetSource, 160),
      updatedAt: entry.updatedAt,
      score,
    });
  }

  return results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
  });
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let index = 0;
  while (true) {
    const found = haystack.indexOf(needle, index);
    if (found === -1) return count;
    count += 1;
    index = found + needle.length;
  }
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}
