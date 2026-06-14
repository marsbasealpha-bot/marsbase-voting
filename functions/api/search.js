/**
 * functions/api/search.js
 * Route: GET /api/search?q=<query>
 *
 * Searches Openverse (https://openverse.org) for a Creative Commons image.
 * Openverse is a free, open API run by Automattic/WordPress — NO API KEY REQUIRED.
 * Falls back to Wikimedia Commons if Openverse returns no results.
 *
 * Returns: { url: string, credit: string }
 * Errors:  { error: string } with 4xx/5xx status
 */

const OPENVERSE_API = 'https://api.openverse.org/v1/images/';
const WIKIMEDIA_API = 'https://en.wikipedia.org/w/api.php';

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const query = url.searchParams.get('q');

  if (!query || query.trim().length === 0) {
    return errorResponse(400, 'Missing query parameter "q"');
  }

  const q = query.trim();

  /* ── Try Openverse first ── */
  try {
    const result = await searchOpenverse(q);
    if (result) {
      return Response.json(result, {
        headers: { 'Cache-Control': 'public, max-age=3600' },
      });
    }
  } catch (err) {
    console.warn('[search] Openverse failed:', err.message);
  }

  /* ── Fallback: Wikimedia Commons ── */
  try {
    const result = await searchWikimedia(q);
    if (result) {
      return Response.json(result, {
        headers: { 'Cache-Control': 'public, max-age=3600' },
      });
    }
  } catch (err) {
    console.warn('[search] Wikimedia fallback failed:', err.message);
  }

  return errorResponse(404, `No images found for "${q}". Try a different keyword.`);
}

/* ── Openverse search ───────────────────────────────── */
async function searchOpenverse(query) {
  const url = `${OPENVERSE_API}?q=${encodeURIComponent(query)}&page_size=10&license_type=commercial,modification`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'MarsBaseVoting/1.0 (https://marsbase.win)' },
    cf: { cacheTtl: 3600, cacheEverything: true },
  });

  if (!res.ok) throw new Error(`Openverse HTTP ${res.status}`);
  const data = await res.json();

  // Pick the first result that has a usable direct image URL
  const results = (data.results || []).filter(r =>
    r.url && (r.url.match(/\.(jpg|jpeg|png|webp)(\?|$)/i))
  );

  if (results.length === 0) return null;

  const photo = results[0];
  return {
    url:    photo.url,
    credit: photo.creator ? `Photo by ${photo.creator} (CC)` : 'Creative Commons image',
    source: 'openverse',
  };
}

/* ── Wikimedia Commons fallback ─────────────────────── */
async function searchWikimedia(query) {
  const params = new URLSearchParams({
    action:      'query',
    generator:   'search',
    gsrnamespace:'6',          // File namespace
    gsrsearch:   query,
    gsrlimit:    '5',
    prop:        'imageinfo',
    iiprop:      'url|size',
    iiurlwidth:  '600',
    format:      'json',
    origin:      '*',
  });

  const res = await fetch(`${WIKIMEDIA_API}?${params}`, {
    cf: { cacheTtl: 3600, cacheEverything: true },
  });

  if (!res.ok) throw new Error(`Wikimedia HTTP ${res.status}`);
  const data = await res.json();

  const pages = Object.values(data?.query?.pages || {});
  for (const page of pages) {
    const info = page?.imageinfo?.[0];
    const imgUrl = info?.thumburl || info?.url;
    if (imgUrl && imgUrl.match(/\.(jpg|jpeg|png|webp)/i)) {
      return { url: imgUrl, credit: 'Wikimedia Commons', source: 'wikimedia' };
    }
  }
  return null;
}

function errorResponse(status, error) {
  return Response.json({ error }, { status });
}
