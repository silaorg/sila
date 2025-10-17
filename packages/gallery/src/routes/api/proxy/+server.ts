import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url, fetch }) => {
  const target = url.searchParams.get('url');
  if (!target) {
    return new Response('Missing url', { status: 400 });
  }

  // Basic safety: allow only http/https
  try {
    const u = new URL(target);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return new Response('Unsupported protocol', { status: 400 });
    }
  } catch {
    return new Response('Invalid url', { status: 400 });
  }

  const res = await fetch(target);
  const body = await res.text();
  const headers = new Headers();
  const contentType = res.headers.get('content-type') || 'text/html; charset=utf-8';
  headers.set('content-type', contentType);

  return new Response(body, { status: res.status, statusText: res.statusText, headers });
};


