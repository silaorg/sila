import { mount } from 'svelte'
import App from './DesktopApp.svelte'
import { setProxyFetch } from '@sila/core'

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app

// Install Electron-backed proxyFetch
if (typeof window !== 'undefined' && (window as any).desktopNet?.proxyFetch) {
  setProxyFetch(async (url, init) => {
    const r = await (window as any).desktopNet.proxyFetch(url, init);
    // Reconstruct a Response in the renderer where DOM APIs exist
    return new Response(r.body, {
      status: r.status,
      statusText: r.statusText,
      headers: new Headers(r.headers)
    });
  })

  // Patch global fetch to route Ollama requests through the proxy
  // This is needed because the AI agent libraries (like aiwrapper) use fetch internally
  // and we can't easily inject the proxyFetch into them.
  const originalFetch = window.fetch;
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();
    // Check for Ollama default address (localhost)
    if (url.includes('localhost:11434') || url.includes('127.0.0.1:11434')) {
      let options = init || {};

      if (input instanceof Request) {
        try {
          const cloned = input.clone();
          const headers: Record<string, string> = {};
          cloned.headers.forEach((v, k) => headers[k] = v);

          const buffer = await cloned.arrayBuffer();

          options = {
            method: cloned.method,
            headers: headers,
            body: buffer.byteLength > 0 ? new Uint8Array(buffer) : undefined,
            ...init
          };
        } catch (e) {
          console.warn("Failed to extract body from Request for proxy:", e);
        }
      }

      const r = await (window as any).desktopNet.proxyFetch(url, options);
      return new Response(r.body, {
        status: r.status,
        statusText: r.statusText,
        headers: new Headers(r.headers)
      });
    }
    return originalFetch(input, init);
  };
}
