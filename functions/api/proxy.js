/**
 * functions/api/proxy.js
 * Route: GET /api/proxy?url=<encoded URL>
 *
 * CORS-safe image proxy.
 * The browser cannot draw cross-origin images onto a Canvas without CORS headers.
 * This function fetches the remote image server-side and returns it with the
 * correct Access-Control-Allow-Origin header so canvas.toBlob() works.
 *
 * Returns: image bytes with correct Content-Type and CORS headers
 * Errors:  { error: string } JSON with 4xx/5xx status
 */

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'image/avif', 'image/svg+xml',
]);

export async function onRequestGet(context) {
  const { request } = context;
  const params = new URL(request.url).searchParams;
  const targetUrl = params.get('url');

  if (!targetUrl) {
    return errorResponse(400, 'Missing "url" query parameter');
  }

  /* Validate URL — must be http/https */
  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return errorResponse(400, 'Invalid URL');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return errorResponse(400, 'Only http/https URLs are supported');
  }

  try {
    const upstream = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MarsBaseProxy/1.0)',
        'Accept': 'image/*,*/*',
      },
      redirect: 'follow',
      cf: { cacheTtl: 86400, cacheEverything: true },
    });

    if (!upstream.ok) {
      return errorResponse(upstream.status, `Upstream returned ${upstream.status}`);
    }

    const contentType = upstream.headers.get('Content-Type') || 'image/jpeg';
    const baseType    = contentType.split(';')[0].trim().toLowerCase();

    if (!ALLOWED_IMAGE_TYPES.has(baseType) && !baseType.startsWith('image/')) {
      return errorResponse(415, `Not an image (got ${contentType})`);
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type':                contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control':               'public, max-age=86400',
        'X-Proxied-By':                'MarsBase',
      },
    });

  } catch (err) {
    console.error('[proxy] Fetch error:', err);
    return errorResponse(502, `Could not fetch image: ${err.message}`);
  }
}

function errorResponse(status, error) {
  return Response.json({ error }, {
    status,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
}
