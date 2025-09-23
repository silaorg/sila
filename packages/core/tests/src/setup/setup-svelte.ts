// Svelte environment setup for testing
import { vi } from 'vitest';

// Mock Svelte runes for testing
if (typeof $state === 'undefined') {
  global.$state = vi.fn((initialValue: any) => {
    let value = initialValue;
    return {
      get value() { return value; },
      set value(newValue: any) { value = newValue; }
    };
  });
}

if (typeof $derived === 'undefined') {
  global.$derived = vi.fn((fn: () => any) => {
    return {
      get value() { return fn(); }
    };
  });
}

if (typeof $effect === 'undefined') {
  global.$effect = vi.fn((fn: () => void) => {
    // Run the effect once
    fn();
    return () => {}; // Return cleanup function
  });
}

// Mock Svelte component lifecycle
if (typeof onMount === 'undefined') {
  global.onMount = vi.fn((fn: () => void | (() => void)) => {
    // Run the onMount function immediately
    return fn();
  });
}

// Mock Svelte stores
if (typeof readable === 'undefined') {
  global.readable = vi.fn((value: any) => ({
    subscribe: (fn: (value: any) => void) => {
      fn(value);
      return { unsubscribe: vi.fn() };
    }
  }));
}

if (typeof writable === 'undefined') {
  global.writable = vi.fn((initialValue: any) => {
    let value = initialValue;
    const subscribers = new Set<(value: any) => void>();
    
    return {
      subscribe: (fn: (value: any) => void) => {
        fn(value);
        subscribers.add(fn);
        return { 
          unsubscribe: () => subscribers.delete(fn) 
        };
      },
      set: (newValue: any) => {
        value = newValue;
        subscribers.forEach(fn => fn(value));
      },
      update: (fn: (value: any) => any) => {
        value = fn(value);
        subscribers.forEach(subscriber => subscriber(value));
      }
    };
  });
}

if (typeof derived === 'undefined') {
  global.derived = vi.fn((stores: any, fn: (...args: any[]) => any) => {
    return {
      subscribe: (callback: (value: any) => void) => {
        // Mock derived store subscription
        const value = fn(stores);
        callback(value);
        return { unsubscribe: vi.fn() };
      }
    };
  });
}

// Mock Svelte component props
if (typeof $props === 'undefined') {
  global.$props = vi.fn(() => ({}));
}

// Mock Svelte component bindings
if (typeof bind === 'undefined') {
  global.bind = vi.fn();
}

// Mock Svelte component events
if (typeof createEventDispatcher === 'undefined') {
  global.createEventDispatcher = vi.fn(() => vi.fn());
}

// Do NOT mock Svelte context; testing library provides it during rendering

// Mock Svelte component lifecycle
if (typeof onDestroy === 'undefined') {
  global.onDestroy = vi.fn(() => {});
}

if (typeof beforeUpdate === 'undefined') {
  global.beforeUpdate = vi.fn(() => {});
}

if (typeof afterUpdate === 'undefined') {
  global.afterUpdate = vi.fn(() => {});
}

// Mock Svelte component tick
if (typeof tick === 'undefined') {
  global.tick = vi.fn(() => Promise.resolve());
}

// Mock Svelte component flushSync
if (typeof flushSync === 'undefined') {
  global.flushSync = vi.fn((fn: () => void) => fn());
}

// Mock Svelte component get
if (typeof get === 'undefined') {
  global.get = vi.fn((store: any) => {
    if (store && typeof store.subscribe === 'function') {
      let value: any;
      const unsubscribe = store.subscribe((v: any) => { value = v; });
      unsubscribe();
      return value;
    }
    return store;
  });
}

// Mock Svelte component set
if (typeof set === 'undefined') {
  global.set = vi.fn((store: any, value: any) => {
    if (store && typeof store.set === 'function') {
      store.set(value);
    }
  });
}

console.log('Svelte environment setup complete');