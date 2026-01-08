import type { RequestHandler } from '@sveltejs/kit';

function validateTarget(target: string): Response | null {
  // Basic safety: allow only http/https
  try {
    const u = new URL(target);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return new Response('Unsupported protocol', { status: 400 });
    }
  } catch {
    return new Response('Invalid url', { status: 400 });
  }

  return null;
}

function proxyHeaders(original: Headers): Headers {
  // Forward only the useful bits. Avoid forwarding browser-only / hop-by-hop headers.
  const headers = new Headers(original);
  headers.delete('host');
  headers.delete('origin');
  headers.delete('referer');
  headers.delete('content-length');

  // Security-ish / fetch metadata headers that can confuse upstreams.
  headers.delete('sec-fetch-site');
  headers.delete('sec-fetch-mode');
  headers.delete('sec-fetch-dest');
  headers.delete('sec-fetch-user');

  return headers;
}

async function handleProxy({ request, url, fetch }: Parameters<RequestHandler>[0]) {
  const target = url.searchParams.get('url');
  if (!target) {
    return new Response('Missing url', { status: 400 });
  }

  const invalid = validateTarget(target);
  if (invalid) return invalid;

  const method = request.method.toUpperCase();
  const headers = proxyHeaders(request.headers);

  // Only include a body when it makes sense.
  const body =
    method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer();

  const res = await fetch(target, {
    method,
    headers,
    body,
  });

  // Keep response minimal but correct for JSON/text consumers.
  const outHeaders = new Headers();
  const contentType = res.headers.get('content-type');
  if (contentType) outHeaders.set('content-type', contentType);

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: outHeaders,
  });
}

export const GET: RequestHandler = handleProxy;
export const POST: RequestHandler = handleProxy;
export const PUT: RequestHandler = handleProxy;
export const PATCH: RequestHandler = handleProxy;
export const DELETE: RequestHandler = handleProxy;


