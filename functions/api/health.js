// GET /api/health — lets you confirm the Functions part of the deployment is live.
export const onRequestGet = () => new Response(JSON.stringify({ ok: true, app: 'luftlinie', version: '3.0.0' }), {
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
