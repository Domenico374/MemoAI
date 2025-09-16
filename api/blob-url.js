// api/blob-url.js
export default function handler(req, res) {
  // Consenti solo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Restituisce un URL fittizio da usare come "blob-url"
  return res.status(200).json({
    ok: true,
    uploadUrl: "/api/echo",  // endpoint di test
    now: Date.now()
  });
}
