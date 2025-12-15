export type ProxyFetch = (url: string, init?: RequestInit) => Promise<Response>;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

const defaultProxyFetch: ProxyFetch = async (url: string, init?: RequestInit) => {
  // In browser (Workbench), go through the local SvelteKit proxy endpoint to avoid CORS
  if (isBrowser()) {
    const proxiedUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
    return fetch(proxiedUrl, init);
  }

  // In Node/Electron main, native fetch has no browser CORS restrictions
  return fetch(url, init);
};

let currentProxyFetch: ProxyFetch = defaultProxyFetch;

export function setProxyFetch(fn: ProxyFetch): void {
  currentProxyFetch = fn;
}

export async function proxyFetch(url: string, init?: RequestInit): Promise<Response> {
  return currentProxyFetch(url, init);
}


