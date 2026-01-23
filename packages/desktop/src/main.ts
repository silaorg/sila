import { mount } from 'svelte'
import App from './DesktopApp.svelte'
import { setProxyFetch } from '@sila/core'
import { setHttpRequestImpl } from 'aiwrapper'

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app

// Install Electron-backed proxyFetch
if (typeof window !== 'undefined' && (window as any).desktopNet?.proxyFetch) {
  const safeProxyFetch = async (url: string, init?: any) => {
    // IPC cannot serialize AbortSignal, so we must remove it.
    const { signal, ...safeOptions } = init || {};
    const r = await (window as any).desktopNet.proxyFetch(url, safeOptions);
    // Reconstruct a Response in the renderer where DOM APIs exist
    return new Response(r.body, {
      status: r.status,
      statusText: r.statusText,
      headers: new Headers(r.headers)
    });
  };

  setProxyFetch(safeProxyFetch);

  // Configure aiwrapper to route Ollama requests through the proxy
  setHttpRequestImpl(async (url, options) => {
    if (url.includes('localhost:11434') || url.includes('127.0.0.1:11434')) {
      return safeProxyFetch(url, options);
    }
    return fetch(url, options);
  });
}
