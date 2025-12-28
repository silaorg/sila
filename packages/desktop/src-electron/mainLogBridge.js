import { BrowserWindow } from 'electron';

const MAX_BUFFER = 500;
/** @type {Array<any>} */
const buffer = [];

/**
 * @param {any} value
 */
function safeSerialize(value) {
  try {
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
  } catch {
    try {
      return String(value);
    } catch {
      return '[unserializable]';
    }
  }
}

/**
 * @param {any} payload
 */
function trySend(payload) {
  try {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win || !win.webContents) return false;
    win.webContents.send('sila:main:log', payload);
    return true;
  } catch {
    return false;
  }
}

/**
 * Patch main-process console methods to also forward to renderer via IPC.
 * Intended for dev debugging (so main logs show up in DevTools console).
 *
 * @param {{ enabled?: boolean }} [opts]
 */
export function patchMainConsole(opts) {
  const enabled = Boolean(opts?.enabled);
  if (!enabled) return;

  // idempotent
  // @ts-ignore
  if (console.__silaMainLogPatched) return;
  // @ts-ignore
  console.__silaMainLogPatched = true;

  const original = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };

  /**
   * @param {'log'|'info'|'warn'|'error'} level
   * @param {any[]} args
   */
  function emit(level, args) {
    const payload = {
      level,
      ts: Date.now(),
      message: args.map(safeSerialize).join(' '),
    };

    if (!trySend(payload)) {
      buffer.push(payload);
      if (buffer.length > MAX_BUFFER) buffer.shift();
    }
  }

  console.log = (...args) => {
    original.log(...args);
    emit('log', args);
  };
  console.info = (...args) => {
    original.info(...args);
    emit('info', args);
  };
  console.warn = (...args) => {
    original.warn(...args);
    emit('warn', args);
  };
  console.error = (...args) => {
    original.error(...args);
    emit('error', args);
  };
}

export function flushMainLogsToRenderer() {
  if (buffer.length === 0) return;
  // best-effort; if we still can't send, keep the buffer
  const copy = buffer.slice();
  let sentAny = false;
  for (const payload of copy) {
    if (trySend(payload)) {
      sentAny = true;
    } else {
      // stop early if renderer isn't ready yet
      break;
    }
  }
  if (sentAny) buffer.length = 0;
}


