import { app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';

const CHAT_SEARCH_INDEX_VERSION = 1;
const indexCache = new Map();

/**
 * @typedef {{ threadId: string; title: string; messages: string[]; searchText?: string; updatedAt?: number }} SearchThreadEntry
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
  if (value.searchText !== undefined && typeof value.searchText !== 'string') return false;
  if (value.updatedAt !== undefined && typeof value.updatedAt !== 'number') return false;
  return true;
}

/**
 * @param {string} spaceId
 * @returns {Promise<ChatSearchIndex | null>}
 */
export async function loadChatSearchIndex(spaceId) {
  if (!spaceId) return null;
  const cached = indexCache.get(spaceId);
  if (cached) return cached;

  try {
    const payload = await fs.readFile(getIndexPath(spaceId), 'utf8');
    const parsed = JSON.parse(payload);
    if (parsed?.version !== CHAT_SEARCH_INDEX_VERSION || !Array.isArray(parsed.entries)) {
      return null;
    }
    if (!parsed.entries.every(isValidSearchEntry)) {
      return null;
    }
    const normalized = {
      ...parsed,
      entries: normalizeEntries(parsed.entries),
    };
    indexCache.set(spaceId, normalized);
    return normalized;
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
  const normalizedEntries = normalizeEntries(entries);
  const payload = {
    version: CHAT_SEARCH_INDEX_VERSION,
    updatedAt: Date.now(),
    entries: normalizedEntries,
  };
  await fs.writeFile(getIndexPath(spaceId), JSON.stringify(payload));
  indexCache.set(spaceId, payload);
}

function buildSearchText(title, messages) {
  return `${title} ${messages.join(' ')}`.toLowerCase();
}

function normalizeEntries(entries) {
  return entries.map((entry) => ({
    ...entry,
    searchText: entry.searchText ?? buildSearchText(entry.title ?? 'New chat', entry.messages),
  }));
}
