import { app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';

const CHAT_SEARCH_INDEX_VERSION = 1;

/**
 * @typedef {{ threadId: string; title: string; messages: string[]; updatedAt?: number }} SearchThreadEntry
 * @typedef {{ threadId: string; title: string; snippet: string; updatedAt?: number; score: number }} SearchResult
 * @typedef {{ version: 1; updatedAt: number; entries: SearchThreadEntry[] }} ChatSearchIndex
 */

function getIndexPath(spaceId) {
  return path.join(app.getPath('userData'), 'search-index', spaceId, 'chat-index.json');
}

async function ensureIndexDir(spaceId) {
  const targetPath = getIndexPath(spaceId);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
}

function isValidSearchEntry(value) {
  if (!value || typeof value !== 'object') return false;
  if (typeof value.threadId !== 'string') return false;
  if (typeof value.title !== 'string') return false;
  if (!Array.isArray(value.messages)) return false;
  if (!value.messages.every((message) => typeof message === 'string')) return false;
  if (value.updatedAt !== undefined && typeof value.updatedAt !== 'number') return false;
  return true;
}

/**
 * @param {string} spaceId
 * @returns {Promise<ChatSearchIndex | null>}
 */
export async function loadChatSearchIndex(spaceId) {
  if (!spaceId) return null;

  try {
    const payload = await fs.readFile(getIndexPath(spaceId), 'utf8');
    const parsed = JSON.parse(payload);
    if (parsed?.version !== CHAT_SEARCH_INDEX_VERSION || !Array.isArray(parsed.entries)) {
      return null;
    }
    if (!parsed.entries.every(isValidSearchEntry)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * @param {string} spaceId
 * @param {SearchThreadEntry[]} entries
 * @returns {Promise<void>}
 */
export async function saveChatSearchIndex(spaceId, entries) {
  if (!spaceId) return;
  await ensureIndexDir(spaceId);
  const payload = {
    version: CHAT_SEARCH_INDEX_VERSION,
    updatedAt: Date.now(),
    entries,
  };
  await fs.writeFile(getIndexPath(spaceId), JSON.stringify(payload));
}

/**
 * @param {SearchThreadEntry[]} entries
 * @param {string} query
 * @returns {SearchResult[]}
 */
export function searchChatThreads(entries, query) {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const results = [];

  for (const entry of entries) {
    const title = entry.title ?? 'New chat';
    const titleLower = title.toLowerCase();
    const combined = `${title} ${entry.messages.join(' ')}`.toLowerCase();
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

/**
 * @param {string} spaceId
 * @param {string} query
 * @returns {Promise<SearchResult[]>}
 */
export async function queryChatSearch(spaceId, query) {
  const index = await loadChatSearchIndex(spaceId);
  if (!index) return [];
  return searchChatThreads(index.entries, query);
}

function tokenize(input) {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function countOccurrences(haystack, needle) {
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

function truncate(value, maxLength) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}
