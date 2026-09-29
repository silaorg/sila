// Adapter-node bundles the app separately from the HTTP entrypoint. This one
// process-local slot hands its initialized transport handlers to that host.
/** @typedef {import('neorest/node').NodeRequestHandlers & { close: () => Promise<void> }} RealtimeHost */
const key = Symbol.for('heswe.realtime-host');
const shared =
  /** @type {typeof globalThis & { [key: symbol]: RealtimeHost | undefined }} */ (
    globalThis
  );

export function getRealtimeHost() {
  return shared[key];
}

/** @param {RealtimeHost} host */
export async function installRealtimeHost(host) {
  const previous = getRealtimeHost();
  // Vite can reload initialization while reusing the same broker handlers.
  if (previous && previous.request !== host.request) await previous.close();
  shared[key] = host;
}
