// api/blob-url.js — test route (Node runtime)
export default async function handler(req, res) {
  if (req.method === 'GET') {
    res.status(200).json({
      ok: true,
      route: '/api/blob-url',
      now: Date.now(),
      runtime: 'node'
    });
    return;
  }

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).end();
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
