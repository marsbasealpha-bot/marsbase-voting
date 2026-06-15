/**
 * functions/api/search.js
 * Route: GET /api/search?q=<query>
 *
 * Three keyless image sources tried in order:
 *  1. Openverse  — Creative Commons images via their CDN thumbnail (always valid)
 *  2. Wikipedia  — page summary thumbnail (extremely reliable for common nouns)
 *  3. Wikimedia Commons — broader file search fallback
 *
 * Returns: { url: string, credit: string }
 * Errors:  { error: string } with 4xx/5xx status
 */

const OPENVERSE_API = 'https://api.openverse.org/v1/images/';
const WIKIPEDIA_SUMMARY = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
const WIKIMEDIA_API = 'https://en.wikipedia.org/w/api.php';

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const query = url.searchParams.get('q');

  if (!query || query.trim().length === 0) {
    return errorResponse(400, 'Missing query parameter "q"');
  }

  const q = query.trim();

  /* ── 1. Openverse (Creative Commons, thumbnail always valid) ── */
  try {
    const result = await searchOpenverse(q);
    if (result) return jsonOk(result);
  } catch (err) {
    console.warn('[search] Openverse failed:', err.message);
  }

  /* ── 2. Wikipedia page summary (best for common nouns) ── */
  try {
    const result = await searchWikipedia(q);
    if (result) return jsonOk(result);
  } catch (err) {
    console.warn('[search] Wikipedia failed:', err.message);
  }

  /* ── 3. Wikimedia Commons ── */
  try {
    const result = await searchWikimedia(q);
    if (result) return jsonOk(result);
  } catch (err) {
    console.warn('[search] Wikimedia failed:', err.message);
  }

  return errorResponse(404, `No images found for "${q}". Try a different keyword.`);
}

/* ── Openverse ──────────────────────────────────────────
   Uses thumbnail field — always a Openverse CDN JPEG, no
   extension-matching needed.
   ────────────────────────────────────────────────────── */
async function searchOpenverse(query) {
  const url = `${OPENVERSE_API}?q=${encodeURIComponent(query)}&page_size=20&license_type=commercial,modification`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'MarsBaseVoting/1.0 (https://marsbase.win)' },
    cf: { cacheTtl: 3600, cacheEverything: true },
  });

  if (!res.ok) throw new Error(`Openverse HTTP ${res.status}`);
  const data = await res.json();

  // Prefer results with a thumbnail (Openverse CDN — always a valid image URL)
  const results = (data.results || []).filter(r => r.thumbnail || r.url);
  if (results.length === 0) return null;

  const photo = results[0];
  const imgUrl = photo.thumbnail || photo.url;

  return {
    url:    imgUrl,
    credit: photo.creator ? `Photo by ${photo.creator} (CC)` : 'Creative Commons image',
    source: 'openverse',
  };
}

/* ── Wikipedia Page Summary ─────────────────────────────
   The REST summary API returns a thumbnail for almost any
   common noun. Very high success rate, zero auth needed.
   ────────────────────────────────────────────────────── */
async function searchWikipedia(query) {
  // Normalise: capitalise first letter (Wikipedia titles)
  const title = query.charAt(0).toUpperCase() + query.slice(1).toLowerCase();
  const res = await fetch(`${WIKIPEDIA_SUMMARY}${encodeURIComponent(title)}`, {
    headers: { 'User-Agent': 'MarsBaseVoting/1.0 (https://marsbase.win)' },
    cf: { cacheTtl: 3600, cacheEverything: true },
  });

  if (!res.ok) return null;  // 404 = no page, silently skip

  const data = await res.json();
  const imgUrl = data?.thumbnail?.source || data?.originalimage?.source;
  if (!imgUrl) return null;

  return {
    url:    imgUrl,
    credit: `Wikipedia: ${data.title}`,
    source: 'wikipedia',
  };
}

/* ── Wikimedia Commons ──────────────────────────────────
   Broader file search. Accepts jpg/jpeg/png/webp/gif in
   both thumburl and url fields.
   ────────────────────────────────────────────────────── */
async function searchWikimedia(query) {
  const params = new URLSearchParams({
    action:       'query',
    generator:    'search',
    gsrnamespace: '6',   // File namespace
    gsrsearch:    query,
    gsrlimit:     '10',
    prop:         'imageinfo',
    iiprop:       'url|size|mediatype',
    iiurlwidth:   '800',
    format:       'json',
    origin:       '*',
  });

  const res = await fetch(`${WIKIMEDIA_API}?${params}`, {
    cf: { cacheTtl: 3600, cacheEverything: true },
  });

  if (!res.ok) throw new Error(`Wikimedia HTTP ${res.status}`);
  const data = await res.json();

  const pages = Object.values(data?.query?.pages || {});
  const validExts = /\.(jpg|jpeg|png|webp|gif)(\?|$)/i;

  for (const page of pages) {
    const info = page?.imageinfo?.[0];
    if (!info) continue;

    const imgUrl = info.thumburl || info.url;
    // Accept bitmap images only (skip SVG/PDF/OGG etc.)
    const mediaType = (info.mediatype || '').toLowerCase();
    if (mediaType && !['bitmap', 'drawing'].includes(mediaType)) continue;
    if (imgUrl && (validExts.test(imgUrl) || info.thumburl)) {
      return { url: imgUrl, credit: 'Wikimedia Commons', source: 'wikimedia' };
    }
  }
  return null;
}

function jsonOk(data) {
  return Response.json(data, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  });
}

function errorResponse(status, error) {
  return Response.json({ error }, { status });
}
