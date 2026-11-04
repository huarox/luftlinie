// GET /api/route?from=lat,lon&to=lat,lon&mode=walk|drive
// Returns {line:[[lat,lon],...]} — the suggested route spectators see for each navigator.
// Uses the FOSSGIS OSRM servers, which (unlike the OSRM demo server) offer a real foot profile.
import { UA, json, allowedOrigin, fetchWithTimeout, cached } from '../_shared.js';

const ROUTERS = {
  drive: ['https://routing.openstreetmap.de/routed-car/route/v1/driving/', 'https://router.project-osrm.org/route/v1/driving/'],
  walk: ['https://routing.openstreetmap.de/routed-foot/route/v1/driving/'],
};

const pair = (value) => {
  const parts = String(value || '').split(',').map(Number);
  return parts.length === 2 && Math.abs(parts[0]) <= 90 && Math.abs(parts[1]) <= 180 && parts.every(Number.isFinite) ? parts : null;
};

export async function onRequestGet(context) {
  const { request } = context;
  if (!allowedOrigin(request)) return json({ error: 'forbidden' }, 403);
  const url = new URL(request.url);
  const from = pair(url.searchParams.get('from')), to = pair(url.searchParams.get('to'));
  const mode = url.searchParams.get('mode') === 'walk' ? 'walk' : 'drive';
  if (!from || !to) return json({ error: 'from and to must be "lat,lon"' }, 400);

  const f = from.map(n => n.toFixed(4)), t = to.map(n => n.toFixed(5));
  const response = await cached(context, `/__cache/route/${mode}/${f.join(',')}/${t.join(',')}`, 600, async () => {
    for (const base of ROUTERS[mode]) {
      try {
        const res = await fetchWithTimeout(`${base}${f[1]},${f[0]};${t[1]},${t[0]}?overview=simplified&geometries=geojson`, { headers: { 'User-Agent': UA } }, 9000);
        if (!res.ok) continue;
        const data = await res.json();
        if (data.code !== 'Ok' || !data.routes?.[0]) continue;
        return { line: data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]), seconds: data.routes[0].duration, metres: data.routes[0].distance };
      } catch { /* next router */ }
    }
    return null;
  });
  return response || json({ error: 'No route available right now.' }, 503);
}
