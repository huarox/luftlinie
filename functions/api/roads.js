// GET /api/roads?lat=&lon=&radius=&mode=walk|drive
// Returns {points:[{lat,lon}]} on public, routable ways near the given point (used by "Pick for me").
import { Core, UA, json, num, allowedOrigin, fetchWithTimeout, cached } from '../_shared.js';

const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

export async function onRequestGet(context) {
  const { request } = context;
  if (!allowedOrigin(request)) return json({ error: 'forbidden' }, 403);
  const url = new URL(request.url);
  const lat = num(url.searchParams.get('lat'), -90, 90);
  const lon = num(url.searchParams.get('lon'), -180, 180);
  const radius = num(url.searchParams.get('radius'), 50, 3000);
  const mode = url.searchParams.get('mode') === 'walk' ? 'walk' : 'drive';
  if (lat == null || lon == null || radius == null) return json({ error: 'lat, lon and radius (50–3000 m) are required' }, 400);

  // Round to ~100 m so nearby lookups share a cache entry; the client filters by exact distance afterwards.
  const rl = lat.toFixed(3), ro = lon.toFixed(3), rr = Math.round(radius / 50) * 50;
  const response = await cached(context, `/__cache/roads/${mode}/${rl}/${ro}/${rr}`, 6 * 3600, async () => {
    const query = Core.overpassQuery(+rl, +ro, rr, mode);
    for (const mirror of MIRRORS) {
      try {
        const res = await fetchWithTimeout(mirror, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
          body: 'data=' + encodeURIComponent(query),
        }, 14000);
        if (!res.ok) continue; // 429 / 504 from a busy mirror: try the next one
        const points = Core.roadPointsFrom(await res.json());
        return { points, source: new URL(mirror).host };
      } catch { /* timeout or network error: next mirror */ }
    }
    return null;
  });
  return response || json({ error: 'All Overpass mirrors are busy. Try again in a minute.' }, 503);
}
