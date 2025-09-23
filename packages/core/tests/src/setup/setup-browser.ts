// Browser environment setup for testing
import { vi } from 'vitest';

// Mock crypto for browser environment
if (typeof crypto === 'undefined') {
  global.crypto = {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9),
  } as any;
}

// Mock FileReader for browser environment
if (typeof FileReader === 'undefined') {
  global.FileReader = class MockFileReader {
    onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
    onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
    result: string | ArrayBuffer | null = null;
    readyState = 0;
    error: DOMException | null = null;

    readAsDataURL(blob: Blob) {
      // Mock implementation that returns a data URL
      setTimeout(() => {
        this.result = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAuMBg9v2e0UAAAAASUVORK5CYII=';
        this.readyState = 2; // DONE
        if (this.onload) {
          this.onload(new ProgressEvent('load') as any);
        }
      }, 10);
    }

    readAsArrayBuffer(blob: Blob) {
      // Mock implementation that returns an ArrayBuffer
      setTimeout(() => {
        this.result = new ArrayBuffer(68);
        this.readyState = 2; // DONE
        if (this.onload) {
          this.onload(new ProgressEvent('load') as any);
        }
      }, 10);
    }

    readAsText(blob: Blob) {
      // Mock implementation that returns text
      setTimeout(() => {
        this.result = 'Hello World';
        this.readyState = 2; // DONE
        if (this.onload) {
          this.onload(new ProgressEvent('load') as any);
        }
      }, 10);
    }

    abort() {
      this.readyState = 0;
      if (this.onerror) {
        this.onerror(new ProgressEvent('error') as any);
      }
    }
  } as any;
}

// Mock Blob for browser environment
if (typeof Blob === 'undefined') {
  global.Blob = class MockBlob {
    constructor(public parts: any[], public options?: any) {}
    size = 0;
    type = '';
    arrayBuffer() { return Promise.resolve(new ArrayBuffer(0)); }
    slice() { return new MockBlob([]); }
    stream() { return new ReadableStream(); }
    text() { return Promise.resolve(''); }
  } as any;
}

// Mock File for browser environment
if (typeof File === 'undefined') {
  global.File = class MockFile extends (global.Blob as any) {
    constructor(
      public parts: any[],
      public name: string,
      public options?: any
    ) {
      super(parts, options);
    }
    lastModified = Date.now();
  } as any;
}

// Mock URL.createObjectURL for browser environment
if (typeof URL !== 'undefined' && !URL.createObjectURL) {
  URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  URL.revokeObjectURL = vi.fn();
}

// Mock localStorage for browser environment
if (typeof localStorage === 'undefined') {
  const store: Record<string, string> = {};
  global.localStorage = {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { Object.keys(store).forEach(key => delete store[key]); }),
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
    length: Object.keys(store).length,
  };
}

// Mock IndexedDB for browser environment
if (typeof indexedDB === 'undefined') {
  global.indexedDB = {
    open: vi.fn(() => ({
      result: {
        createObjectStore: vi.fn(),
        transaction: vi.fn(() => ({
          objectStore: vi.fn(() => ({
            get: vi.fn(() => Promise.resolve(null)),
            put: vi.fn(() => Promise.resolve()),
            delete: vi.fn(() => Promise.resolve()),
            clear: vi.fn(() => Promise.resolve()),
          })),
        })),
      },
      onupgradeneeded: null,
      onsuccess: null,
      onerror: null,
    })),
    deleteDatabase: vi.fn(() => Promise.resolve()),
  } as any;
}

// Mock window for browser environment
if (typeof window === 'undefined') {
  global.window = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    postMessage: vi.fn(),
    location: { href: 'http://localhost:3000' },
    document: global.document,
    localStorage: global.localStorage,
    indexedDB: global.indexedDB,
    crypto: global.crypto,
    FileReader: global.FileReader,
    Blob: global.Blob,
    File: global.File,
    URL: global.URL,
  } as any;
}

// Mock document for browser environment
if (typeof document === 'undefined') {
  global.document = {
    createElement: vi.fn((tag: string) => ({
      tagName: tag.toUpperCase(),
      setAttribute: vi.fn(),
      getAttribute: vi.fn(),
      appendChild: vi.fn(),
      removeChild: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      click: vi.fn(),
      style: {},
    })),
    createTextNode: vi.fn((text: string) => ({ textContent: text })),
    getElementById: vi.fn(() => null),
    querySelector: vi.fn(() => null),
    querySelectorAll: vi.fn(() => []),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    body: {
      appendChild: vi.fn(),
      removeChild: vi.fn(),
    },
    head: {
      appendChild: vi.fn(),
      removeChild: vi.fn(),
    },
  } as any;
}

// Mock console for consistent logging
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

// Mock setTimeout and setInterval for consistent timing
global.setTimeout = vi.fn((callback: any, delay: number) => {
  return setTimeout(callback, delay);
}) as any;

global.setInterval = vi.fn((callback: any, delay: number) => {
  return setInterval(callback, delay);
}) as any;

// Mock fetch for network requests
if (typeof fetch === 'undefined') {
  global.fetch = vi.fn(() => 
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    })
  );
}

// Mock ResizeObserver for browser environment
if (typeof ResizeObserver === 'undefined') {
  global.ResizeObserver = class MockResizeObserver {
    constructor(public callback: ResizeObserverCallback) {}
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  } as any;
}

// Mock IntersectionObserver for browser environment
if (typeof IntersectionObserver === 'undefined') {
  global.IntersectionObserver = class MockIntersectionObserver {
    constructor(public callback: IntersectionObserverCallback) {}
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  } as any;
}

// Mock MutationObserver for browser environment
if (typeof MutationObserver === 'undefined') {
  global.MutationObserver = class MockMutationObserver {
    constructor(public callback: MutationCallback) {}
    observe = vi.fn();
    disconnect = vi.fn();
  } as any;
}

// Mock Performance API for browser environment
if (typeof performance === 'undefined') {
  global.performance = {
    now: vi.fn(() => Date.now()),
    mark: vi.fn(),
    measure: vi.fn(),
    getEntriesByType: vi.fn(() => []),
    getEntriesByName: vi.fn(() => []),
    clearMarks: vi.fn(),
    clearMeasures: vi.fn(),
  } as any;
}

// Mock requestAnimationFrame for browser environment
if (typeof requestAnimationFrame === 'undefined') {
  global.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
    return setTimeout(callback, 16); // ~60fps
  });
}

if (typeof cancelAnimationFrame === 'undefined') {
  global.cancelAnimationFrame = vi.fn((handle: number) => {
    clearTimeout(handle);
  });
}

// Mock Web Workers for browser environment
if (typeof Worker === 'undefined') {
  global.Worker = class MockWorker {
    constructor(public scriptURL: string) {}
    postMessage = vi.fn();
    terminate = vi.fn();
    addEventListener = vi.fn();
    removeEventListener = vi.fn();
    onmessage = null;
    onerror = null;
  } as any;
}

// Mock SharedArrayBuffer for browser environment
if (typeof SharedArrayBuffer === 'undefined') {
  global.SharedArrayBuffer = ArrayBuffer as any;
}

// Mock Atomics for browser environment
if (typeof Atomics === 'undefined') {
  global.Atomics = {
    load: vi.fn(),
    store: vi.fn(),
    add: vi.fn(),
    sub: vi.fn(),
    and: vi.fn(),
    or: vi.fn(),
    xor: vi.fn(),
    exchange: vi.fn(),
    compareExchange: vi.fn(),
    wait: vi.fn(),
    notify: vi.fn(),
    waitAsync: vi.fn(),
  } as any;
}

console.log('Browser environment setup complete');