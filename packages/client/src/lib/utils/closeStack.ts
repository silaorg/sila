import { useClientState } from '@sila/client/state/clientStateContext';

export type CloseStackOptions = {
  hub?: { on: (event: string, fn: () => boolean) => () => void };
  handle: () => boolean;
  eventName?: string;
};

type CloseStackParams = CloseStackOptions | (() => boolean);

// Svelte action for subscribing a DOM node to a named, LIFO event stack (default: "close").
// The most recently registered handler runs first. Return true from the handler to consume.
//
// Simple usage (auto-detect hub via context):
//   <div use:closeStack={() => { /* close layer */ return true }} />
//
// Explicit options (custom hub or event name):
//   <div use:closeStack={{ hub: clientState.events, handle: () => true, eventName: 'close' }} />
//
// Notes
// - The handler should be idempotent and fast.
// - Unsubscription happens automatically when the node is destroyed or params change.
export function closeStack(node: HTMLElement, params: CloseStackParams) {
  let off: (() => void) | null = null;

  function toOptions(p: CloseStackParams): CloseStackOptions {
    if (typeof p === 'function') {
      return { handle: p };
    }
    return p;
  }

  function subscribe(p: CloseStackParams) {
    off?.();
    const opts = toOptions(p);
    const state = useClientState();
    const hub = opts.hub ?? state.events;
    const event = opts.eventName ?? 'close';
    off = hub.on(event, () => opts.handle());
  }

  if (params) subscribe(params);

  return {
    update(newParams: CloseStackParams) {
      if (newParams) subscribe(newParams);
    },
    destroy() {
      off?.();
    }
  };
}


