// api/blob-url.js
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // Compat: restituisce un uploadUrl che punta al nuovo /api/upload
  res.status(200).json({ ok: true, uploadUrl: '/api/upload', now: Date.now() });
}
