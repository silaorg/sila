import { ChatAppData, type Space } from "@sila/core";

export type SearchThreadEntry = {
  threadId: string;
  title: string;
  messages: string[];
  searchText?: string;
  updatedAt?: number;
};

export type SearchResult = {
  threadId: string;
  title: string;
  snippet: string;
  updatedAt?: number;
  score: number;
};

type ChatSearchIndex = {
  version: 1;
  updatedAt: number;
  entries: SearchThreadEntry[];
};

type BuildChatSearchOptions = {
  forceRebuild?: boolean;
};

type DesktopSearchBridge = {
  loadChatIndex?: (spaceId: string) => Promise<ChatSearchIndex | null>;
  saveChatIndex?: (spaceId: string, entries: SearchThreadEntry[]) => Promise<boolean>;
};

const CHAT_SEARCH_INDEX_VERSION = 1 as const;

export async function buildChatSearchEntries(
  space: Space,
  options: BuildChatSearchOptions = {},
): Promise<SearchThreadEntry[]> {
  const persistedIndex = options.forceRebuild ? null : await loadChatSearchIndex(space);
  const existingEntries = new Map(
    (persistedIndex?.entries ?? []).map((entry) => [entry.threadId, entry])
  );
  const appTreeRefs = space.getAppTreeIds();
  const appTreeIds = appTreeRefs.length > 0
    ? appTreeRefs
        .map((vertexId) => space.getVertex(vertexId)?.getProperty("tid"))
        .filter((treeId): treeId is string => typeof treeId === "string")
    : space.getLoadedAppTrees().map((tree) => tree.getId());
  const entries: SearchThreadEntry[] = [];
  const processed = new Set<string>();
  let shouldPersist = options.forceRebuild ?? false;

  for (const appTreeId of appTreeIds) {
    let appTree = space.getAppTree(appTreeId);
    if (!appTree) {
      try {
        appTree = await space.loadAppTree(appTreeId);
      } catch {
        const cached = existingEntries.get(appTreeId);
        if (cached) {
          entries.push(cached);
          processed.add(appTreeId);
        }
        continue;
      }
    }
    if (!appTree) continue;

    const appId = appTree.getAppId();
    if (appId === "files") continue;

    const chatData = new ChatAppData(space, appTree);
    const spaceVertex = space.getVertexReferencingAppTree(appTreeId);
    const title = chatData.title ?? spaceVertex?.name ?? "New chat";
    const updatedAt = appTree.tree.root?.updatedAt?.getTime()
      ?? appTree.tree.root?.createdAt?.getTime();

    const cached = existingEntries.get(appTreeId);
    processed.add(appTreeId);

    if (cached && updatedAt !== undefined && cached.updatedAt === updatedAt) {
      const searchText = buildSearchText(title, cached.messages);
      if (cached.title !== title || cached.searchText !== searchText) {
        shouldPersist = true;
      }
      entries.push({
        ...cached,
        title,
        searchText,
        updatedAt,
      });
      continue;
    }

    const messages = chatData.messageVertices
      .map((vertex) => vertex.getProperty("text"))
      .filter((text): text is string => typeof text === "string" && text.trim().length > 0);
    const searchText = buildSearchText(title, messages);

    entries.push({
      threadId: appTreeId,
      title,
      messages,
      searchText,
      updatedAt,
    });
    shouldPersist = true;
  }

  if (!shouldPersist && persistedIndex) {
    for (const entryId of existingEntries.keys()) {
      if (!processed.has(entryId)) {
        shouldPersist = true;
        break;
      }
    }
  }

  if (shouldPersist) {
    await saveChatSearchIndex(space, entries);
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
    const combined = entry.searchText ?? buildSearchText(title, entry.messages);
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

export async function queryChatSearch(
  entries: SearchThreadEntry[],
  query: string,
): Promise<SearchResult[]> {
  return searchChatThreads(entries, query);
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

function buildSearchText(title: string, messages: string[]): string {
  return `${title} ${messages.join(" ")}`.toLowerCase();
}

async function loadChatSearchIndex(space: Space): Promise<ChatSearchIndex | null> {
  const desktopSearch = getDesktopSearch();
  if (desktopSearch?.loadChatIndex) {
    try {
      const remoteIndex = await desktopSearch.loadChatIndex(space.getId());
      if (!remoteIndex) return null;
      if (remoteIndex?.version !== CHAT_SEARCH_INDEX_VERSION || !Array.isArray(remoteIndex.entries)) {
        return null;
      }
      if (!remoteIndex.entries.every(isValidSearchEntry)) {
        return null;
      }
      return remoteIndex;
    } catch {
      return null;
    }
  }

  return null;
}

function isValidSearchEntry(value: unknown): value is SearchThreadEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as SearchThreadEntry;
  if (typeof entry.threadId !== "string") return false;
  if (typeof entry.title !== "string") return false;
  if (!Array.isArray(entry.messages)) return false;
  if (!entry.messages.every((message) => typeof message === "string")) return false;
  if (entry.searchText !== undefined && typeof entry.searchText !== "string") return false;
  if (entry.updatedAt !== undefined && typeof entry.updatedAt !== "number") return false;
  return true;
}

async function saveChatSearchIndex(space: Space, entries: SearchThreadEntry[]): Promise<void> {
  const desktopSearch = getDesktopSearch();
  if (desktopSearch?.saveChatIndex) {
    await desktopSearch.saveChatIndex(space.getId(), entries);
    return;
  }
}

function getDesktopSearch(): DesktopSearchBridge | null {
  if (typeof window === "undefined") return null;
  return ((window as any).desktopSearch ?? null) as DesktopSearchBridge | null;
}
