/**
 * functions/_middleware.js
 * Runs for ALL routes — adds CORS headers and handles preflight.
 */

export async function onRequest(context) {
  // Handle OPTIONS preflight
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  const response = await context.next();

  // Clone and add CORS headers to all API responses
  const newResponse = new Response(response.body, response);
  Object.entries(corsHeaders()).forEach(([k, v]) => newResponse.headers.set(k, v));
  return newResponse;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
