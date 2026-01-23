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
    const { streamId, status, statusText, headers } = await (window as any).desktopNet.proxyFetch(url, safeOptions);

    // Construct a ReadableStream from the IPC events
    let unsubscribe: (() => void) | undefined;
    const body = new ReadableStream({
      start(controller) {
        unsubscribe = (window as any).desktopNet.onStreamEvent(streamId, (type: 'data'|'end'|'error', data?: any) => {
          try {
            if (type === 'data') {
              controller.enqueue(data);
            } else if (type === 'end') {
              if (unsubscribe) {
                unsubscribe();
                unsubscribe = undefined;
              }
              controller.close();
            } else if (type === 'error') {
              if (unsubscribe) {
                unsubscribe();
                unsubscribe = undefined;
              }
              controller.error(new Error(data));
            }
          } catch (e) {
            // Controller might be closed already
            if (unsubscribe) {
              unsubscribe();
              unsubscribe = undefined;
            }
          }
        });
      },
      cancel() {
        if (unsubscribe) {
          unsubscribe();
          unsubscribe = undefined;
        }
        // Ideally we should tell the main process to stop streaming, but for now we just stop listening.
        // We can implement a cancel IPC if needed.
      }
    });

    return new Response(body, {
      status,
      statusText,
      headers: new Headers(headers)
    });
  };

  setProxyFetch(safeProxyFetch);

  // Configure aiwrapper to route ALL requests through the proxy
  // This allows robust streaming and CORS bypass for any provider.
  setHttpRequestImpl(async (url, options) => {
    return safeProxyFetch(url, options);
  });
}
