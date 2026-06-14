/**
 * functions/api/caption.js
 * Route: POST /api/caption
 * Body:  { image: "<base64 string>", mimeType: "image/jpeg" }
 *
 * Uses Cloudflare Workers AI (model: @cf/unum/uform-gen2-qwen-500m)
 * to generate a short text description of the uploaded image.
 *
 * Requires: Workers AI binding named "AI" — set in Cloudflare Dashboard:
 *   Workers & Pages → marsbase-voting → Settings → Bindings → Add → Workers AI → variable name: AI
 *
 * Returns: { description: string }
 * Errors:  { error: string }
 */

export async function onRequestPost(context) {
  const { env, request } = context;

  /* Validate AI binding is present */
  if (!env.AI) {
    return Response.json(
      { error: 'Workers AI binding not configured. Add it in Cloudflare Dashboard → Settings → Bindings.' },
      { status: 503 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { image, mimeType = 'image/jpeg' } = body;
  if (!image) {
    return Response.json({ error: 'Missing "image" field (base64 string)' }, { status: 400 });
  }

  /* Validate size — CF AI limit is ~4 MB */
  const estimatedBytes = (image.length * 3) / 4;
  if (estimatedBytes > 4 * 1024 * 1024) {
    return Response.json({ error: 'Image too large (max 4 MB)' }, { status: 413 });
  }

  try {
    /* Decode base64 → Uint8Array */
    const binary   = atob(image);
    const byteArr  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) byteArr[i] = binary.charCodeAt(i);

    /* Run Workers AI */
    const result = await env.AI.run(
      '@cf/unum/uform-gen2-qwen-500m',
      {
        image:      [...byteArr],
        prompt:     'What is the main subject of this image? Give only the name in 1 to 4 words. Be very concise.',
        max_tokens: 40,
      }
    );

    const raw = result?.description || '';
    if (!raw.trim()) {
      return Response.json({ description: null }, { status: 200 });
    }

    return Response.json({ description: raw.trim() });

  } catch (err) {
    console.error('[caption] Workers AI error:', err);
    return Response.json({ error: `AI error: ${err.message}` }, { status: 502 });
  }
}
