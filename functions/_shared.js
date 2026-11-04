// Shared helpers for the Cloudflare Pages Functions under /api.
// These proxy public OpenStreetMap services so the browser gets one fast, cached, same-origin endpoint
// with mirror fallback, instead of each phone hitting rate-limited public servers directly.
import CoreModule from '../core.js';

export const Core = CoreModule?.overpassQuery ? CoreModule : globalThis.LuftlinieCore;
export const UA = 'Luftlinie/3.0 (+https://luftlinie.huarox.com; real-world distance game)';

export function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
  });
}

export const num = (value, min, max) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

// Only same-site pages may use the proxy; it is not an open relay for other sites.
export function allowedOrigin(request) {
  const origin = request.headers.get('Origin') || request.headers.get('Referer');
  if (!origin) return true; // same-origin GETs from the app often omit Origin
  try { return new URL(origin).host === new URL(request.url).host; } catch { return false; }
}

export async function fetchWithTimeout(url, init, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...init, signal: ctrl.signal }); }
  finally { clearTimeout(timer); }
}

// Edge cache keyed by a synthetic GET URL, so identical lookups from many players cost one upstream call.
export async function cached(context, key, ttlSeconds, produce) {
  const cache = caches.default;
  const cacheKey = new Request(new URL(key, context.request.url).toString(), { method: 'GET' });
  const hit = await cache.match(cacheKey);
  if (hit) return hit;
  const body = await produce();
  if (body == null) return null;
  const response = json(body, 200, { 'Cache-Control': `public, max-age=${ttlSeconds}` });
  context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
