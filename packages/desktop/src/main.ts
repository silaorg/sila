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
}
